// 地理：世界底图打点 / 连线 / 区域裁剪。
// 视觉语言（v3）：陆地 = 浅色表面 + 0.6px 结构描边；经纬网 = 发丝线；
// 标记 = 业务蓝实心 + 表面描边（半径 3.5–9px 按数值缩放）；连线 = 35% 透明虚线。
import React from 'react'
import { z } from 'zod'
import { defineComponent } from '@openuidev/lang-core'
import { displayText, FallbackNotice } from '../render-safety.jsx'
import { T, FS, CAPTION_PX, tickWidth } from './theme.js'
import { PanelTitle, useExpanded, ExpandToggle } from './shared.jsx'
import { WORLD_PATH } from '../world-map.mjs'

// 世界坐标画布（960×480 ≈ 2:1 等距圆柱投影）。
const W = 960
const H = 480
const px = (lon) => ((lon + 180) / 360) * W
const py = (lat) => ((90 - lat) / 180) * H
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

export const components = [
  defineComponent({
    name: 'Map',
    description:
      'World map (equirectangular) with markers plotted from lat/lon and optional links between them. ' +
      'points=[{lat, lon, label?, value?}]; links=[[i, j]] draws lines between point indices; ' +
      'bbox=[west, south, east, north] crops the view to a region (e.g. [73, 18, 135, 54] for China). ' +
      'value scales the marker radius. Use for geographic distribution, nodes or routes.',
    props: z.object({
      title: z.string().optional(),
      points: z
        .array(
          z.object({
            lat: z.number(),
            lon: z.number(),
            label: z.string().optional(),
            value: z.number().optional()
          })
        )
        .default([]),
      links: z.array(z.array(z.number())).default([]),
      bbox: z.array(z.number()).optional(),
      height: z.number().default(260),
      showLabels: z.boolean().default(true)
    }),
    component: ({ props }) => {
      const [open, toggle] = useExpanded()
      const frameRef = React.useRef(null)
      const [measuredWidth, setMeasuredWidth] = React.useState(0)
      React.useEffect(() => {
        const el = frameRef.current
        if (!el) return
        const measure = () => setMeasuredWidth(el.getBoundingClientRect().width)
        measure()
        if (typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(measure)
        observer.observe(el)
        return () => observer.disconnect()
      }, [open, props])

      const pts = (props.points ?? [])
        .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon))
        .map((p) => ({ ...p, lat: clamp(p.lat, -85, 85), lon: clamp(p.lon, -180, 180) }))
      const vals = pts.map((p) => p.value ?? 0)
      const vmax = Math.max(1, ...vals)
      const vmin = Math.min(0, ...vals)
      // 半径以屏幕像素计（3.5–9px），与 viewBox 缩放无关，裁剪到城市级也不会变成巨圆。
      const rOf = (p) => {
        if (p.value == null) return 4
        const t = (p.value - vmin) / (vmax - vmin || 1)
        return 3.5 + clamp(t, 0, 1) * 4.5
      }

      // 帧尺寸：紧凑 / 展开的高度口径与原来一致；宽度取实测容器宽（SSR 用正文列宽名义值）。
      const frameW = measuredWidth || 780
      const frameH = open
        ? Math.max(460, props.height)
        : Math.max(220, Math.round(props.height * 0.85))
      const aspect = frameW / frameH

      // 请求的裁剪区域（世界坐标）。默认全世界；无效值回退到全世界，并保底最小跨度。
      const raw = Array.isArray(props.bbox) && props.bbox.length === 4 ? props.bbox : null
      const bbOk = raw != null && raw.every((v) => Number.isFinite(v))
      let lon0 = -180,
        lon1 = 180,
        lat0 = -85,
        lat1 = 85
      if (bbOk) {
        lon0 = clamp(Math.min(raw[0], raw[2]), -180, 180)
        lon1 = clamp(Math.max(raw[0], raw[2]), -180, 180)
        lat0 = clamp(Math.min(raw[1], raw[3]), -85, 85)
        lat1 = clamp(Math.max(raw[1], raw[3]), -85, 85)
        if (lon1 - lon0 < 0.05) {
          const c = (lon0 + lon1) / 2
          lon0 = clamp(c - 0.025, -180, 180)
          lon1 = clamp(c + 0.025, -180, 180)
        }
        if (lat1 - lat0 < 0.05) {
          const c = (lat0 + lat1) / 2
          lat0 = clamp(c - 0.025, -85, 85)
          lat1 = clamp(c + 0.025, -85, 85)
        }
      }
      const reqX0 = px(lon0),
        reqX1 = px(lon1)
      const reqY0 = py(lat1),
        reqY1 = py(lat0)
      let bw = Math.max(1, reqX1 - reqX0)
      let bh = Math.max(1, reqY1 - reqY0)
      // 只向四周扩充视野（绝不裁掉请求区域），让地图填满版心 —— 避免宽容器里出现一块小方图。
      if (bw / bh < aspect) {
        const needW = bh * aspect
        if (needW <= W) bw = needW
        else {
          const needH = bw / aspect
          if (needH <= H) bh = needH
        }
      } else {
        const needH = bw / aspect
        if (needH <= H) bh = needH
        else {
          const needW = bh * aspect
          if (needW <= W) bw = needW
        }
      }
      // 以请求区域中心为锚，整体限制在世界边界内（请求区域始终完整可见）。
      const vx = clamp((reqX0 + reqX1) / 2 - bw / 2, 0, Math.max(0, W - bw))
      const vy = clamp((reqY0 + reqY1) / 2 - bh / 2, 0, Math.max(0, H - bh))
      const vb = { x: vx, y: vy, w: bw, h: bh }
      // 屏幕 1px 对应的用户单位；所有描边/字号/半径按它的倒数换算，缩放到城市级也保持一致。
      const s = vb.w / frameW
      const fixed = (n) => n.toFixed(4)
      const viewBox = `${fixed(vx)} ${fixed(vy)} ${fixed(bw)} ${fixed(bh)}`

      // 经纬网：每 30° 一格，跨整个世界画线，由 SVG 视口自然裁剪。
      const grat = []
      for (let lon = -180; lon <= 180; lon += 30) grat.push([px(lon), 0, px(lon), H])
      for (let lat = -60; lat <= 60; lat += 30) grat.push([0, py(lat), W, py(lat)])

      // 标签：只标数值最大的 5 个，并做简单的屏幕坐标避让（不压点、不互相重叠、不出画框）。
      const labelled = []
      if (props.showLabels && pts.length > 0) {
        const candidates = pts
          .map((p) => p)
          .filter((p) => p.label != null && displayText(p.label) !== '')
        const ranked = candidates
          .slice()
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 5)
        const placed = []
        for (const p of ranked) {
          const text = displayText(p.label)
          const sx = (px(p.lon) - vb.x) / s
          const sy = (py(p.lat) - vb.y) / s
          const r = rOf(p)
          const tw = Math.min(frameW - 12, Math.max(18, tickWidth(text)))
          const options = [
            { anchor: 'start', dx: r + 5, dy: -(r + 3) }, // 右上
            { anchor: 'start', dx: r + 5, dy: r + 12 }, // 右下
            { anchor: 'end', dx: -(r + 5), dy: -(r + 3) }, // 左上
            { anchor: 'end', dx: -(r + 5), dy: r + 12 } // 左下
          ]
          for (const o of options) {
            const x0 = o.anchor === 'start' ? sx + o.dx : sx + o.dx - tw
            const y0 = sy + o.dy - CAPTION_PX
            const box = { x0, y0, x1: x0 + tw, y1: y0 + CAPTION_PX + 1 }
            if (box.x0 < 2 || box.x1 > frameW - 2 || box.y0 < 2 || box.y1 > frameH - 2) continue
            const hit = placed.some(
              (b) =>
                box.x0 < b.x1 + 8 && box.x1 > b.x0 - 8 && box.y0 < b.y1 + 2 && box.y1 > b.y0 - 2
            )
            if (hit) continue
            placed.push(box)
            labelled.push({ p, text, anchor: o.anchor, dx: o.dx, dy: o.dy })
            break
          }
        }
      }

      if (pts.length === 0) {
        return (
          <div style={{ minWidth: 0 }}>
            <PanelTitle>{props.title}</PanelTitle>
            <FallbackNotice>没有可绘制的坐标点</FallbackNotice>
          </div>
        )
      }

      return (
        <div ref={frameRef} style={{ minWidth: 0 }}>
          <PanelTitle>{props.title}</PanelTitle>
          <svg
            viewBox={viewBox}
            role="img"
            aria-label={`${props.title ?? '地图'}；${pts.map((p) => displayText(p.label ?? `${p.lat}, ${p.lon}`)).join('、')}`}
            preserveAspectRatio="xMidYMid meet"
            style={{
              width: '100%',
              height: frameH,
              display: 'block',
              transition: 'height .25s ease'
            }}
          >
            <title>{props.title ?? '地图'}</title>
            {/* 经纬网 */}
            {grat.map((g, i) => (
              <line
                key={`g${i}`}
                x1={g[0]}
                y1={g[1]}
                x2={g[2]}
                y2={g[3]}
                stroke={T.hairline}
                strokeWidth={fixed(1 * s)}
              />
            ))}
            {/* 陆地 */}
            <path
              d={WORLD_PATH}
              fill={T.surfaceTint}
              stroke={T.border}
              strokeWidth={fixed(0.6 * s)}
              strokeLinejoin="round"
            />
            {/* 视口边框：bbox 裁剪时给裁剪边界一条精确发丝线 */}
            <rect
              x={fixed(vb.x)}
              y={fixed(vb.y)}
              width={fixed(vb.w)}
              height={fixed(vb.h)}
              fill="none"
              stroke={T.hairline}
              strokeWidth={fixed(1 * s)}
            />
            {/* 连线：accent 虚线 35% 透明 */}
            {(props.links ?? []).map((pair, i) => {
              if (!Array.isArray(pair) || pair.length < 2) return null
              const a = pts[pair[0]]
              const b = pts[pair[1]]
              if (!a || !b) return null
              return (
                <line
                  key={`l${i}`}
                  x1={px(a.lon)}
                  y1={py(a.lat)}
                  x2={px(b.lon)}
                  y2={py(b.lat)}
                  stroke={T.accent}
                  strokeWidth={fixed(1.2 * s)}
                  strokeOpacity="0.35"
                  strokeDasharray={`${fixed(4 * s)} ${fixed(3 * s)}`}
                />
              )
            })}
            {/* 标记：值决定半径（3.5–9px），表面描边把点和陆地分开 */}
            {pts.map((p, i) => (
              <g key={`p${i}`}>
                <circle
                  cx={fixed(px(p.lon))}
                  cy={fixed(py(p.lat))}
                  r={fixed(rOf(p) * s)}
                  fill={T.accent}
                  stroke={T.surface}
                  strokeWidth={fixed(2 * s)}
                />
                <title>
                  {p.label != null
                    ? `${displayText(p.label)}（${p.lat}, ${p.lon}）`
                    : `${p.lat}, ${p.lon}`}
                </title>
              </g>
            ))}
            {/* 标签：caption/inkSecondary + 表面色描边，压在陆地/网格上仍清晰 */}
            {labelled.map(({ p, text, anchor, dx, dy }, i) => (
              <text
                key={`t${i}`}
                transform={`translate(${fixed(px(p.lon) + dx * s)} ${fixed(py(p.lat) + dy * s)}) scale(${s})`}
                fontSize={FS.caption}
                textAnchor={anchor}
                fill={T.inkSecondary}
                stroke={T.surface}
                strokeWidth="2.5"
                paintOrder="stroke"
              >
                {text}
              </text>
            ))}
          </svg>
          <ExpandToggle open={open} onToggle={toggle} note={open ? null : `${pts.length} 个点`} />
        </div>
      )
    }
  })
]
