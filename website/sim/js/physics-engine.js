/**
 * @fileoverview PhysicsEngine — Bucle principal de simulación con timestep fijo.
 *
 * Usa requestAnimationFrame con acumulador de timestep fijo (60 FPS).
 * Soporta multiplicador de velocidad (0.1× a 5×) y callbacks onUpdate/onRender.
 */

const DEFAULT_DT = 1 / 60;
const MAX_FRAME_TIME = 0.1; // 100 ms
const MIN_SPEED = 0.1;
const MAX_SPEED = 5;

/**
 * Contexto 2D estable en móviles/tablets.
 * `desynchronized:true` provoca basura de color (píxeles basura) en GPUs
 * Android/Xiaomi (Mali/Adreno); solo se considera en escritorio no-táctil.
 */
function createCanvas2d(canvas) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const touch =
    typeof navigator !== 'undefined' &&
    (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod|Mobile/i.test(ua));
  // Preferir opaco y sin desync en táctiles / Android
  if (touch || /Android/i.test(ua)) {
    return (
      canvas.getContext('2d', { alpha: false, desynchronized: false }) ||
      canvas.getContext('2d', { alpha: false }) ||
      canvas.getContext('2d')
    );
  }
  try {
    return (
      canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
      canvas.getContext('2d', { alpha: false }) ||
      canvas.getContext('2d')
    );
  } catch {
    return canvas.getContext('2d', { alpha: false }) || canvas.getContext('2d');
  }
}

export class PhysicsEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = createCanvas2d(canvas);

    this._running = false;
    this._paused = false;
    this._speed = 1;
    this._accumulator = 0;
    this._lastTime = 0;
    this._frameId = null;
    this._maxSubsteps = 5;

    this._fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
    this._dpr = 1;
    this._resizeObs = null;
    this._resizeRaf = 0;

    this._bindResize();

    /**
     * Callback: onUpdate(dt) — llamado en cada tick de física.
     * @type {function(number): void|undefined}
     */
    this.onUpdate = null;

    /**
     * Callback: onRender(ctx, dt, elapsed) — llamado en cada frame renderizado.
     * @type {function(CanvasRenderingContext2D, number, number): void|undefined}
     */
    this.onRender = null;

    /**
     * Callback: onPauseChanged(paused) — notifica cambios de pausa.
     * @type {function(boolean): void|undefined}
     */
    this.onPauseChanged = null;

    /**
     * Callback tras redimensionar el canvas (p. ej. invalidar caché del renderer).
     * @type {function(): void|undefined}
     */
    this.onResize = null;

    this._elapsed = 0;
    this._visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    this._onVis = () => {
      this._visible = document.visibilityState !== 'hidden';
      if (this._visible && this._running) {
        this._lastTime = performance.now() / 1000;
        this._accumulator = 0;
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this._onVis);
    }
  }

  /**
   * Inicia el bucle de simulación.
   */
  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._lastTime = performance.now() / 1000;
    this._tick(this._lastTime);
  }

  /**
   * Detiene el bucle por completo.
   */
  stop() {
    this._running = false;
    this._paused = false;
    if (this._frameId !== null) {
      cancelAnimationFrame(this._frameId);
      this._frameId = null;
    }
  }

  /** Libera observers (al destruir la app). El loop se corta con stop(). */
  dispose() {
    this.stop();
    if (this._resizeObs) {
      try {
        this._resizeObs.disconnect();
      } catch {
        /* ignore */
      }
      this._resizeObs = null;
    }
    if (typeof document !== 'undefined' && this._onVis) {
      document.removeEventListener('visibilitychange', this._onVis);
    }
  }

  /** Aplica transform HiDPI y suavizado de forma determinista. */
  applyDprTransform() {
    if (!this.ctx) return;
    const dpr = this._dpr || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    try {
      this.ctx.imageSmoothingQuality = 'medium';
    } catch {
      /* ignore */
    }
  }

  /** Ajusta buffer del canvas al tamaño CSS × devicePixelRatio (nítido y estable). */
  _bindResize() {
    const apply = () => {
      const canvas = this.canvas;
      if (!canvas) return;

      // Si el lab está oculto, no redimensionar a 0×0 (basura al mostrar)
      if (canvas.offsetParent === null && canvas.getClientRects().length === 0) {
        return;
      }

      const parent = canvas.parentElement;
      const rect = canvas.getBoundingClientRect();
      let w = Math.floor(rect.width);
      let h = Math.floor(rect.height);

      // Fallback si el canvas aún no tiene caja (flex sin altura)
      if (w < 2 || h < 2) {
        const headerH = parent?.querySelector?.('.canvas-header')?.offsetHeight || 0;
        const footerH = parent?.querySelector?.('.canvas-footer')?.offsetHeight || 0;
        const pw = parent?.clientWidth || 0;
        const ph = parent?.clientHeight || 0;
        w = Math.max(2, Math.floor(pw || canvas.clientWidth || 320));
        h = Math.max(
          2,
          Math.floor((ph || canvas.clientHeight || 240) - headerH - footerH - 8)
        );
      }

      // DPR: en móviles altos (Xiaomi 2.5–3) limitar para no saturar GPU
      const rawDpr = window.devicePixelRatio || 1;
      const isCoarse =
        typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
      const maxDpr = isCoarse || rawDpr > 2.25 ? 1.75 : 2;
      let dpr = Math.min(Math.max(rawDpr, 1), maxDpr);

      let bw = Math.max(1, Math.round(w * dpr));
      let bh = Math.max(1, Math.round(h * dpr));

      // Límite de textura: evita fallos/artefactos en tablets
      const maxSide = isCoarse ? 2048 : 4096;
      if (bw > maxSide || bh > maxSide) {
        const s = Math.min(maxSide / bw, maxSide / bh);
        bw = Math.max(1, Math.floor(bw * s));
        bh = Math.max(1, Math.floor(bh * s));
        dpr = bw / Math.max(w, 1);
      }

      this._dpr = dpr;
      const changed = canvas.width !== bw || canvas.height !== bh;
      if (changed) {
        canvas.width = bw;
        canvas.height = bh;
      }
      // Siempre reaplicar transform (tras width= se resetea el contexto)
      this.applyDprTransform();

      if (typeof this.onResize === 'function') {
        try {
          this.onResize();
        } catch {
          /* ignore */
        }
      }
      // Un repaint tras resize
      this.requestPaint?.();
    };

    const schedule = () => {
      if (this._resizeRaf) return;
      this._resizeRaf = requestAnimationFrame(() => {
        this._resizeRaf = 0;
        apply();
      });
    };

    apply();
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObs = new ResizeObserver(() => schedule());
      this._resizeObs.observe(this.canvas);
      if (this.canvas.parentElement) this._resizeObs.observe(this.canvas.parentElement);
      const main = document.querySelector('.main-area');
      if (main) this._resizeObs.observe(main);
    } else {
      window.addEventListener('resize', schedule);
      window.addEventListener('orientationchange', schedule);
    }
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      visualViewport.addEventListener('resize', schedule);
    }
    this.resizeCanvas = apply;
  }

  /**
   * Pausa o reanuda la simulación.
   * @param {boolean} [pause] - Opcional: true para pausar, false para reanudar.
   */
  pause(pause) {
    if (pause === undefined) pause = !this._paused;
    this._paused = pause;
    this._pauseRendered = false;
    if (this.onPauseChanged) this.onPauseChanged(this._paused);
    if (!this._paused) {
      this._lastTime = performance.now() / 1000;
      // Reactivar bucle si quedó en idle de pausa
      if (this._running && this._frameId === null) {
        this._tick(this._lastTime);
      }
    }
  }

  /**
   * Reinicia la simulación (acumulador y tiempo a cero).
   */
  reset() {
    this._accumulator = 0;
    this._lastTime = performance.now() / 1000;
    this._elapsed = 0;
    this._fps = 0;
    this._fpsFrames = 0;
    this._fpsTime = 0;
  }

  /**
   * Define el multiplicador de velocidad.
   * @param {number} mult - Valor entre 0.1 y 5
   */
  setSpeed(mult) {
    this._speed = Math.max(MIN_SPEED, Math.min(MAX_SPEED, mult));
  }

  /** @returns {number} Velocidad actual */
  getSpeed() {
    return this._speed;
  }

  /** @returns {boolean} Si la simulación está pausada */
  isPaused() {
    return this._paused;
  }

  /** @returns {boolean} Si el bucle RAF está activo */
  isRunning() {
    return this._running;
  }

  /** @returns {number} Tiempo simulado transcurrido en segundos */
  getElapsed() {
    return this._elapsed;
  }

  /** @returns {number} FPS calculados */
  getFps() {
    return this._fps;
  }

  /**
   * Fuerza un tick de física (útil para avance por paso).
   */
  step() {
    if (this.onUpdate) this.onUpdate(DEFAULT_DT);
    this._elapsed += DEFAULT_DT;
    this.requestPaint();
  }

  /**
   * Bucle interno: requestAnimationFrame.
   * @param {number} now - Timestamp de performance.now() / 1000
   */
  _tick(now) {
    if (!this._running) return;
    this._frameId = requestAnimationFrame((t) => this._tick(t / 1000));

    // Pestaña oculta: no gastar CPU/GPU (solo reprograma el frame)
    if (!this._visible) {
      this._lastTime = now;
      this._accumulator = 0;
      return;
    }

    // Cálculo de FPS
    this._fpsFrames++;
    this._fpsTime += this._lastTime ? now - this._lastTime : 0;
    if (this._fpsTime >= 1) {
      this._fps = Math.round(this._fpsFrames / this._fpsTime);
      this._fpsFrames = 0;
      this._fpsTime = 0;
    }

    // Timestep acumulador
    let frameTime = now - this._lastTime;
    this._lastTime = now;

    if (this._paused) {
      // En pausa: un paint y se detiene el RAF hasta unpause/requestPaint/step
      if (this.onRender && !this._pauseRendered) {
        this.onRender(this.ctx, 0, this._elapsed);
        this._pauseRendered = true;
      }
      if (this._frameId !== null) {
        cancelAnimationFrame(this._frameId);
        this._frameId = null;
      }
      return;
    }
    this._pauseRendered = false;

    // Limitar frameTime para evitar espirales de muerte
    if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;

    this._accumulator += frameTime * this._speed;

    // Limitar substeps: evita cascadas de física en pestañas en segundo plano
    let steps = 0;
    while (this._accumulator >= DEFAULT_DT && steps < this._maxSubsteps) {
      if (this.onUpdate) this.onUpdate(DEFAULT_DT);
      this._accumulator -= DEFAULT_DT;
      this._elapsed += DEFAULT_DT;
      steps++;
    }
    if (this._accumulator >= DEFAULT_DT) {
      this._accumulator = 0;
    }

    if (this.onRender) this.onRender(this.ctx, this._accumulator / DEFAULT_DT, this._elapsed);
  }

  /** Fuerza un repaint en pausa (p. ej. al cambiar parámetros). */
  requestPaint() {
    this._pauseRendered = false;
    if (this._running && this._paused && this._frameId === null) {
      this._lastTime = performance.now() / 1000;
      this._tick(this._lastTime);
    }
  }
}
