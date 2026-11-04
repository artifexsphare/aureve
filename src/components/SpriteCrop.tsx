import React from 'react';
import { MODELS_SHEET_URL, MODEL_Y0, MODEL_Y1, PIECES_SHEET_URL } from '../data/initialCatalog';
import { Product } from '../types';

interface SpriteCropSvgProps {
  href: string;
  x0: number;
  y0: number;
  w: number;
  h: number;
  sheetW: number;
  sheetH: number;
  className?: string;
}

/**
 * Exact Rule #3: Two sprite sheets, cropped with SVG.
 * Inline <svg viewBox> holding a nested <svg> so nothing outside the box can ever show.
 */
export const SpriteCropSvg: React.FC<SpriteCropSvgProps> = ({
  href,
  x0,
  y0,
  w,
  h,
  sheetW,
  sheetH,
  className,
}) => {
  const vb = `${x0} ${y0} ${w} ${h}`;
  return (
    <svg viewBox={vb} aria-hidden="true" className={className}>
      <svg x={x0} y={y0} width={w} height={h} viewBox={vb}>
        <image href={href} width={sheetW} height={sheetH} />
      </svg>
    </svg>
  );
};

export const ModelSpriteSvg: React.FC<{ x0: number; x1: number; className?: string }> = ({
  x0,
  x1,
  className,
}) => (
  <SpriteCropSvg
    href={MODELS_SHEET_URL}
    x0={x0}
    y0={MODEL_Y0}
    w={x1 - x0}
    h={MODEL_Y1 - MODEL_Y0}
    sheetW={960}
    sheetH={540}
    className={className}
  />
);

export const ProductVisual: React.FC<{
  product: Product;
  className?: string;
  imageIndex?: number;
}> = ({ product, className = 'w-full h-full', imageIndex = 0 }) => {
  const [imgError, setImgError] = React.useState(false);

  const selectedImg = product.images && product.images[imageIndex];
  if (selectedImg && !imgError) {
    return (
      <img
        src={selectedImg}
        alt={product.name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${className} object-cover`}
      />
    );
  }

  if (product.spriteBox && product.spriteBox.length === 4) {
    const [x0, x1, y0, y1] = product.spriteBox;
    return (
      <SpriteCropSvg
        href={PIECES_SHEET_URL}
        x0={x0}
        y0={y0}
        w={x1 - x0}
        h={y1 - y0}
        sheetW={960}
        sheetH={720}
        className={className}
      />
    );
  }

  return (
    <div
      className={`${className} flex flex-col items-center justify-center bg-[#f3f6fa] text-[#737b86] p-6 text-center`}
    >
      <span className="wide text-[10px] tracking-[0.18em] text-[#16191f]">{product.name}</span>
      <span className="text-xs mt-1">{product.category}</span>
    </div>
  );
};
