/**
 * Structural spec, so item presets and block presets can both drive this
 * control without either importing the other's key union.
 */
export interface AnySliderSpec {
  key: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

interface Props {
  spec: AnySliderSpec;
  value: number;
  onChange: (value: number) => void;
}

/**
 * Big, plain-language slider. The range comes from the preset spec, so the
 * control physically cannot express an out-of-range value.
 */
export function Slider({ spec, value, onChange }: Props) {
  const clamped = Math.max(spec.min, Math.min(spec.max, value));
  return (
    <div className="slider">
      <div className="slider__head">
        <label className="slider__label" htmlFor={`slider-${spec.key}`}>
          {spec.label}
        </label>
        <output className="slider__value" htmlFor={`slider-${spec.key}`}>
          {clamped}
          {spec.unit ? ` ${spec.unit}` : ''}
        </output>
      </div>
      <input
        id={`slider-${spec.key}`}
        className="slider__input"
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={clamped}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p className="slider__hint tiny muted">{spec.hint}</p>
    </div>
  );
}
