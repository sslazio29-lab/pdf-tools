/** サムネイルの表示サイズ。CSSクラス `size-sm/md/lg` に対応。 */
export type ThumbSize = 'sm' | 'md' | 'lg'

const OPTIONS: { value: ThumbSize; label: string }[] = [
  { value: 'sm', label: '小' },
  { value: 'md', label: '中' },
  { value: 'lg', label: '大' },
]

type Props = {
  value: ThumbSize
  onChange: (size: ThumbSize) => void
}

/** サムネイルサイズの切替トグル（小・中・大）。SplitView と EditView で共有する。 */
function SizeToggle({ value, onChange }: Props) {
  return (
    <div className="size-row" role="radiogroup" aria-label="サムネイルサイズ">
      <span className="size-label">表示サイズ</span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`size-btn${value === o.value ? ' active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default SizeToggle
