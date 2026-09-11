import { useEffect, useMemo, useState } from 'react';

const KEYFRAMES = `
@keyframes ldMatrixFall { from { transform: translateY(-50%); } to { transform: translateY(0); } }
@keyframes ldMatrixRise { from { transform: translateY(0); } to { transform: translateY(-50%); } }
`;

// Deterministic pseudo-random so the rain pattern is stable across re-renders.
function rand(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
}

function useViewportHeight() {
    const [h, setH] = useState(() =>
        typeof window === 'undefined' ? 800 : window.innerHeight,
    );
    useEffect(() => {
        const onResize = () => setH(window.innerHeight);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return h;
}

/**
 * Full-bleed background of many small arrows falling (down) or rising (up),
 * Matrix-rain style. Purely decorative — the KPI is drawn on top of it.
 */
export default function MatrixArrowRain({
    direction,
    color,
    arrowSize,
    columnCount,
    opacity,
    animate,
    speed,
    glow,
}) {
    const viewportHeight = useViewportHeight();

    const rowsPerHalf = Math.max(
        3,
        Math.ceil(viewportHeight / (arrowSize * 1.9)) + 1,
    );

    const columns = useMemo(
        () =>
            Array.from({ length: columnCount }, (_, col) => {
                const jitter = rand(col + 1);
                const cells = Array.from({ length: rowsPerHalf }, (_, row) => {
                    const r = rand((col + 1) * 97 + row * 13);
                    return {
                        key: `${col}-${row}`,
                        // Brightest cells lead the trail, dim ones fill it in.
                        alpha: 0.12 + r * 0.88,
                        visible: r > 0.12,
                    };
                });
                return {
                    key: col,
                    cells,
                    duration: speed * (0.6 + jitter * 0.9),
                    delay: -jitter * speed * 2,
                };
            }),
        [columnCount, rowsPerHalf, speed],
    );

    const glyph = direction === 'down' ? '▼' : '▲';
    const animationName =
        direction === 'down' ? 'ldMatrixFall' : direction === 'up' ? 'ldMatrixRise' : null;
    const running = animate && animationName !== null;

    const half = (col) => (
        <div
            style={{
                height: '50%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                alignItems: 'center',
            }}
        >
            {col.cells.map((cell) => (
                <span
                    key={cell.key}
                    style={{
                        fontSize: arrowSize,
                        lineHeight: 1,
                        color,
                        opacity: cell.visible ? cell.alpha * opacity : 0,
                        textShadow: glow ? `0 0 ${arrowSize * 0.6}px ${color}` : 'none',
                        userSelect: 'none',
                    }}
                >
                    {glyph}
                </span>
            ))}
        </div>
    );

    return (
        <div
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex' }}
        >
            <style>{KEYFRAMES}</style>
            {columns.map((col) => (
                <div key={col.key} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '200%',
                            display: 'flex',
                            flexDirection: 'column',
                            animation: running
                                ? `${animationName} ${col.duration}s linear ${col.delay}s infinite`
                                : 'none',
                        }}
                    >
                        {half(col)}
                        {half(col)}
                    </div>
                </div>
            ))}
        </div>
    );
}
