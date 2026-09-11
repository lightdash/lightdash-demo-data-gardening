import { useMemo } from 'react';
import { useVizContext, getFormatted, getRaw } from '@lightdash/query-sdk';
import MatrixArrowRain from './MatrixArrowRain';

const FALLBACK = {
    positive: '#22C55E',
    negative: '#EF4444',
    neutral: '#6B7280',
    background: '#000000',
    text: '#FFFFFF',
};

function hexToRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    if (!m) return `rgba(0,0,0,${alpha})`;
    const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16));
    return `rgba(${r},${g},${b},${alpha})`;
}

export default function KpiArrowMatrix() {
    const { fieldMapping, rows, options, ready } = useVizContext();

    const periodField = fieldMapping['period'];
    const valueField = fieldMapping['value'];

    const title = options['title'];
    const kpiFontSize = options['kpiFontSize'];
    const showDelta = options['showDelta'];
    const deltaSuffix = options['deltaSuffix'];
    const compareTo = options['compareTo'];
    const positiveColor = options['positiveColor'] || FALLBACK.positive;
    const negativeColor = options['negativeColor'] || FALLBACK.negative;
    const neutralColor = options['neutralColor'] || FALLBACK.neutral;
    const backgroundColor = options['backgroundColor'] || FALLBACK.background;
    const textColor = options['textColor'] || FALLBACK.text;
    const arrowSize = options['arrowSize'];
    const columnCount = options['columnCount'];
    const arrowOpacity = options['arrowOpacity'];
    const animate = options['animate'];
    const animationSpeed = options['animationSpeed'];
    const glow = options['glow'];

    const computed = useMemo(() => {
        if (!ready || !valueField || !rows?.length) return null;

        let ordered = rows;
        if (periodField) {
            ordered = [...rows].sort((a, b) => {
                const av = getRaw(a, periodField);
                const bv = getRaw(b, periodField);
                if (av == null || bv == null) return 0;
                return av > bv ? 1 : av < bv ? -1 : 0;
            });
        }

        const last = ordered[ordered.length - 1];
        const currentRaw = Number(getRaw(last, valueField) ?? 0);
        const currentDisplay = getFormatted(last, valueField);
        const priorRows = ordered.slice(0, -1);

        let baseline = null;
        if (priorRows.length) {
            if (compareTo === 'first') {
                baseline = Number(getRaw(priorRows[0], valueField) ?? 0);
            } else if (compareTo === 'average') {
                const sum = priorRows.reduce(
                    (acc, r) => acc + Number(getRaw(r, valueField) ?? 0),
                    0,
                );
                baseline = sum / priorRows.length;
            } else {
                baseline = Number(getRaw(priorRows[priorRows.length - 1], valueField) ?? 0);
            }
        }

        let direction = 'neutral';
        let pctChange = null;
        if (baseline !== null) {
            if (currentRaw > baseline) direction = 'up';
            else if (currentRaw < baseline) direction = 'down';
            if (baseline !== 0) pctChange = ((currentRaw - baseline) / Math.abs(baseline)) * 100;
        }

        const periodLabel = periodField ? getFormatted(last, periodField) : null;

        return { currentDisplay, direction, pctChange, periodLabel };
    }, [ready, rows, periodField, valueField, compareTo]);

    const shellStyle = {
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: backgroundColor,
        color: textColor,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    };

    if (!ready || !valueField || !computed) {
        return (
            <div style={{ ...shellStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, opacity: 0.85 }}>
                    {!ready ? 'Loading…' : 'Map a metric to render the KPI'}
                </span>
            </div>
        );
    }

    const { currentDisplay, direction, pctChange, periodLabel } = computed;
    const accent =
        direction === 'up' ? positiveColor : direction === 'down' ? negativeColor : neutralColor;

    return (
        <div style={shellStyle}>
            <MatrixArrowRain
                direction={direction}
                color={accent}
                arrowSize={arrowSize}
                columnCount={columnCount}
                opacity={arrowOpacity}
                animate={animate}
                speed={animationSpeed}
                glow={glow}
            />

            {/* Vignette so the KPI stays legible over the rain */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(ellipse at center, ${backgroundColor} 0%, ${hexToRgba(
                        backgroundColor,
                        0.88,
                    )} 32%, ${hexToRgba(backgroundColor, 0)} 68%)`,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: kpiFontSize * 0.12,
                    textAlign: 'center',
                    padding: 24,
                }}
            >
                {title ? (
                    <div
                        style={{
                            fontSize: Math.max(11, kpiFontSize * 0.2),
                            fontWeight: 600,
                            letterSpacing: '0.18em',
                            textTransform: 'uppercase',
                            opacity: 0.72,
                        }}
                    >
                        {title}
                    </div>
                ) : null}

                <div
                    style={{
                        fontSize: kpiFontSize,
                        fontWeight: 700,
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        textShadow: glow ? `0 0 ${kpiFontSize * 0.5}px ${hexToRgba(accent, 0.55)}` : 'none',
                    }}
                >
                    {currentDisplay}
                </div>

                {showDelta && pctChange !== null ? (
                    <div
                        style={{
                            fontSize: Math.max(12, kpiFontSize * 0.24),
                            fontWeight: 700,
                            color: accent,
                            textShadow: glow ? `0 0 ${kpiFontSize * 0.3}px ${hexToRgba(accent, 0.5)}` : 'none',
                        }}
                    >
                        {direction === 'down' ? '▼' : direction === 'up' ? '▲' : '■'}{' '}
                        {pctChange > 0 ? '+' : ''}
                        {pctChange.toFixed(1)}%{deltaSuffix ? ` ${deltaSuffix}` : ''}
                    </div>
                ) : null}

                {periodLabel ? (
                    <div style={{ fontSize: Math.max(10, kpiFontSize * 0.16), opacity: 0.5 }}>
                        {periodLabel}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
