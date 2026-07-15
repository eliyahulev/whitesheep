// Material Symbols (Rounded) icon. The font is loaded in index.html; the icon name is
// passed as the ligature text. Use Material Symbols names, e.g. <Icon name="home" />.
// Docs: https://fonts.google.com/icons
export function Icon({
  name,
  size = 22,
  fill = false,
  weight = 400,
  className = '',
  color,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  weight?: number;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={`material-symbols-rounded${className ? ` ${className}` : ''}`}
      aria-hidden="true"
      style={{
        fontSize: size,
        color,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
    >
      {name}
    </span>
  );
}
