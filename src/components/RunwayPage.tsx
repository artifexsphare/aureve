import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import {
  FIRST_LOOK,
  MODELS_SHEET_URL,
  MODEL_Y0,
  MODEL_Y1,
  PIECES_SHEET_URL,
  RUNWAY_LOOKS,
  RUNWAY_RAIL_PRODUCT_IDS,
} from '../data/initialCatalog';
import { SpriteCropSvg } from './SpriteCrop';

// Exact Rule #2 & #5 Depth Table Stops from d = -1 to d = 5
const KX = [1.2, 0.744, 0.496, 0.346, 0.235, 0.15, 0.085];
const KF = [1.14, 0.89, 0.777, 0.704, 0.651, 0.616, 0.59];
const KH = [1.18, 0.832, 0.574, 0.436, 0.334, 0.258, 0.19];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const N = RUNWAY_LOOKS.length;
const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export const RunwayPage: React.FC = () => {
  const navigate = useNavigate();
  const { products, wishlist, toggleWishlist, addToCart } = useStore();

  const stageRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const waitRef = useRef<HTMLDivElement | null>(null);
  const modelElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const cardElsRef = useRef<(HTMLElement | null)[]>([]);
  const currentLookRef = useRef<number>(FIRST_LOOK);

  // Ordered 12 runway items synced with catalog pricing/stock
  const railProducts = RUNWAY_RAIL_PRODUCT_IDS.map(
    (id) => products.find((p) => p.id === id) || products[0]
  );

  useEffect(() => {
    const stage = stageRef.current;
    const rail = railRef.current;
    const ring = ringRef.current;
    const roll = rollRef.current;
    const wait = waitRef.current;
    if (!stage || !rail || !ring || !roll) return;

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const modelState = RUNWAY_LOOKS.map((lk) => ({
      r: (lk.x1 - lk.x0) / (MODEL_Y1 - MODEL_Y0),
      f: '',
      o: '',
    }));

    let W = 0;
    let H = 0;
    let base = 0;
    let cardS = 0;
    let side = false;
    let dirty = true;
    let p = 0;
    let target = 0;
    let last = 0;

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
    let down = false;
    let sx = 0;
    let st = 0;
    let moved = 0;
    let wheelT: ReturnType<typeof setTimeout> | undefined;
    let rafId = 0;

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 1.2;
      side = window.innerWidth <= 820;

      modelElsRef.current.forEach((el, i) => {
        if (!el) return;
        el.style.width = `${base * modelState[i].r}px`;
        el.style.height = `${base}px`;
      });

      cardS = side ? 160 : rail.clientHeight / 3;
      cardElsRef.current.forEach((c) => {
        if (!c) return;
        c.style.height = side ? '100%' : `${cardS}px`;
      });

      dirty = true;
    };

    const paint = () => {
      currentLookRef.current = FIRST_LOOK + (Math.round(wrap(p, N)) % N);

      modelElsRef.current.forEach((el, i) => {
        if (!el) return;
        let d = wrap(i - p, N);
        if (d > N - 1) d -= N;
        const k = clamp(d + 1, 0, 6);
        const a = Math.floor(k);
        const b = Math.min(6, a + 1);
        const t = k - a;
        const mix = (A: number[]) => A[a] + (A[b] - A[a]) * t;

        const h = mix(KH) * H;
        const s = base > 0 ? h / base : 1;
        const w = h * modelState[i].r;
        const x = mix(KX) * W - w / 2;
        const y = mix(KF) * H - h;

        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${s.toFixed(4)})`;

        const f = s > 0 ? mix(KB) / s : 0;
        const fs = f < 0.2 ? 'none' : `blur(${f.toFixed(1)}px)`;
        const o = mix(KO).toFixed(3);

        if (fs !== modelState[i].f) {
          modelState[i].f = fs;
          el.style.filter = fs;
        }
        if (o !== modelState[i].o) {
          modelState[i].o = o;
          el.style.opacity = o;
        }
        el.style.zIndex = String(100 - Math.round(d * 10));
      });

      const all = cardS * railProducts.length;
      cardElsRef.current.forEach((c, i) => {
        if (!c || all <= 0) return;
        let y = wrap(i * cardS - p * 2 * cardS, all);
        if (y > all - cardS) y -= all;
        c.style.transform = side
          ? `translate3d(${y.toFixed(1)}px,0,0)`
          : `translate3d(0,${y.toFixed(1)}px,0)`;
      });

      const firstB = roll.firstElementChild as HTMLElement | null;
      if (firstB) {
        roll.style.transform = `translate3d(0,${(-wrap(p, N) * firstB.offsetHeight).toFixed(1)}px,0)`;
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(50, now - last) || 16;
      last = now;
      const was = p;
      if (calm) p = target;
      else p += (target - p) * (1 - Math.exp(-dt * 0.0072));
      if (Math.abs(target - p) < 0.0004) p = target;
      if (p !== was || dirty) {
        dirty = false;
        paint();
      }
      cx += (mx - cx) * 0.32;
      cy += (my - cy) * 0.32;
      ring.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      rafId = requestAnimationFrame(frame);
    };

    const pullDist = () => Math.max(150, W * 0.2);

    const onPointerEnter = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') ring.classList.add('show');
    };
    const onPointerLeave = () => {
      ring.classList.remove('show');
    };
    const onPointerMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      target = st + dx / pullDist();
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('a') || t?.closest('button')) return;
      down = true;
      sx = e.clientX;
      st = target;
      moved = 0;
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        // ignore if unsupported
      }
      ring.classList.add('drag');
    };
    const onRelease = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      ring.classList.remove('drag');
      if (moved < 6) {
        const hit = document
          .elementsFromPoint(e.clientX, e.clientY)
          .find((x) => x.classList && x.classList.contains('mv-model')) as HTMLElement | undefined;
        if (hit && hit.dataset.i !== undefined) {
          let d = wrap(Number(hit.dataset.i) - target, N);
          d = Math.round(d);
          if (d > 0 && d < N) target = Math.round(target) + d;
        }
      } else {
        target = Math.round(target);
      }
    };
    const onWheel = (e: WheelEvent) => {
      const isVertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX);
      if (isVertical) {
        if (window.scrollY > 10) return;
        if (e.deltaY > 0 && target >= N - 1) return;
        if (e.deltaY < 0 && target <= 0) return;
      }
      e.preventDefault();
      target += clamp(e.deltaY + e.deltaX, -120, 120) / 420;
      clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        target = Math.round(target);
      }, 150);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') return;
      if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        target = Math.round(target) + 1;
      }
      if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        target = Math.round(target) - 1;
      }
    };

    window.addEventListener('resize', size);
    stage.addEventListener('pointerenter', onPointerEnter);
    stage.addEventListener('pointerleave', onPointerLeave);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointerup', onRelease);
    stage.addEventListener('pointercancel', onRelease);
    stage.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    size();
    paint();
    rafId = requestAnimationFrame(frame);

    // Preload both sheets + fonts before fading the #f1f5fa cover
    Promise.all(
      [MODELS_SHEET_URL, PIECES_SHEET_URL].map((u) => {
        const img = new Image();
        img.src = u;
        return img.decode().catch(() => {});
      })
    )
      .then(() => (document.fonts ? document.fonts.ready.then(() => {}) : Promise.resolve()))
      .then(() => {
        size();
        paint();
        wait?.classList.add('gone');
      });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(wheelT);
      window.removeEventListener('resize', size);
      stage.removeEventListener('pointerenter', onPointerEnter);
      stage.removeEventListener('pointerleave', onPointerLeave);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointerup', onRelease);
      stage.removeEventListener('pointercancel', onRelease);
      stage.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [railProducts.length]);

  const handleShopCurrentLook = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/shop?look=${currentLookRef.current}`);
  };

  return (
    <>
      <main className="mv-runway-main">
        <section
          className="mv-stage"
          ref={stageRef}
          aria-label="Runway looks. Drag, scroll or use the arrow keys to change look."
          tabIndex={0}
        >
          <div className="mv-line">
            {RUNWAY_LOOKS.map((look, i) => (
              <div
                key={look.lookNumber}
                className="mv-model"
                data-i={i}
                ref={(el) => {
                  modelElsRef.current[i] = el;
                }}
              >
                <SpriteCropSvg
                  href={MODELS_SHEET_URL}
                  x0={look.x0}
                  y0={MODEL_Y0}
                  w={look.x1 - look.x0}
                  h={MODEL_Y1 - MODEL_Y0}
                  sheetW={960}
                  sheetH={540}
                />
              </div>
            ))}
          </div>

          <div className="mv-intro">
            <h2 className="wide">Spring Summer 2027</h2>
            <p>
              A study in softness and strength. The new season collection from AUREVÉ blends
              delicate textures and modern silhouettes, crafted for a more beautiful tomorrow.
            </p>
          </div>

          <div className="mv-tag">
            <div className="mv-look wide" aria-live="polite">
              <span>Look</span>
              <span className="mv-win">
                <span className="mv-roll" ref={rollRef}>
                  {Array.from({ length: N + 1 }).map((_, idx) => (
                    <b key={idx}>{FIRST_LOOK + (idx % N)}</b>
                  ))}
                </span>
              </span>
            </div>
            <button type="button" onClick={handleShopCurrentLook} className="mv-shop-link wide">
              Shop the look
            </button>
          </div>

          <div className="mv-ring" ref={ringRef} />
        </section>

        <aside className="mv-rail" ref={railRef} aria-label="Pieces in this look">
          {railProducts.map((piece, i) => {
            const isSaved = wishlist.includes(piece.id);
            const displayPrice =
              typeof piece.salePrice === 'number' && piece.salePrice < piece.price
                ? piece.salePrice
                : piece.price;
            const box = piece.spriteBox || [26, 224, 28, 214];
            return (
              <article
                key={piece.id}
                className={`mv-rail-card${i % 2 ? ' alt' : ''}`}
                ref={(el) => {
                  cardElsRef.current[i] = el;
                }}
              >
                <button
                  type="button"
                  className="mv-fav"
                  aria-pressed={isSaved}
                  aria-label={`Save ${piece.name}`}
                  onClick={() => toggleWishlist(piece.id)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.600 4.600 0 0 1 20.500 9C20.500 15 12 20 12 20Z" />
                  </svg>
                </button>

                <span
                  className="mv-shot"
                  onClick={() => navigate(`/product/${piece.slug}`)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') navigate(`/product/${piece.slug}`);
                  }}
                  aria-label={`View ${piece.name}`}
                >
                  <SpriteCropSvg
                    href={PIECES_SHEET_URL}
                    x0={box[0]}
                    y0={box[2]}
                    w={box[1] - box[0]}
                    h={box[3] - box[2]}
                    sheetW={960}
                    sheetH={720}
                  />
                </span>

                <div className="mv-meta">
                  <h3 className="wide">
                    <button
                      type="button"
                      onClick={() => navigate(`/product/${piece.slug}`)}
                      className="text-left hover:underline"
                    >
                      {piece.name}
                    </button>
                  </h3>
                  <span>Rs. {displayPrice.toLocaleString()}</span>
                  <button
                    type="button"
                    className="mv-add"
                    aria-label={`Add ${piece.name} to cart`}
                    onClick={() => addToCart(piece.id, 1)}
                  />
                </div>
              </article>
            );
          })}
        </aside>
      </main>
      <div className="mv-wait" ref={waitRef} />
    </>
  );
};
