import React from 'react';
import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

/**
 * Shared stroke-style SVG icons (Feather-inspired, 24×24 viewBox) so the UI
 * renders identically on every device instead of falling back to the system
 * emoji font. All icons take the same props.
 */
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

type SvgIconProps = IconProps & { children: React.ReactNode };

function IconBase({ size = 22, color = '#888', strokeWidth = 2, children }: SvgIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function ChevronLeftIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="15 18 9 12 15 6" />
    </IconBase>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="9 18 15 12 9 6" />
    </IconBase>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="6 9 12 15 18 9" />
    </IconBase>
  );
}

export function ChevronUpIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="18 15 12 9 6 15" />
    </IconBase>
  );
}

export function CameraIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <Circle cx="12" cy="13" r="4" />
    </IconBase>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Circle cx="12" cy="12" r="10" />
      <Polyline points="12 6 12 12 16 14" />
    </IconBase>
  );
}

export function GearIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </IconBase>
  );
}

export function ClipboardIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <Rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <Line x1="9" y1="12" x2="15" y2="12" />
      <Line x1="9" y1="16" x2="13" y2="16" />
    </IconBase>
  );
}

export function PlayIcon({ size = 22, color = '#888' }: IconProps) {
  // Filled triangle reads better at small sizes than a stroked one.
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Polygon points="6 3 21 12 6 21 6 3" />
    </Svg>
  );
}

export function PauseIcon({ size = 22, color = '#888' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x="5" y="4" width="5" height="16" rx="1" />
      <Rect x="14" y="4" width="5" height="16" rx="1" />
    </Svg>
  );
}

export function XIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Line x1="18" y1="6" x2="6" y2="18" />
      <Line x1="6" y1="6" x2="18" y2="18" />
    </IconBase>
  );
}

export function CheckIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="20 6 9 17 4 12" />
    </IconBase>
  );
}

export function DownloadIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="7 10 12 15 17 10" />
      <Line x1="12" y1="15" x2="12" y2="3" />
    </IconBase>
  );
}

export function UploadIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <Polyline points="17 8 12 3 7 8" />
      <Line x1="12" y1="3" x2="12" y2="15" />
    </IconBase>
  );
}

export function TrashIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </IconBase>
  );
}

export function AlertTriangleIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <Line x1="12" y1="9" x2="12" y2="13" />
      <Line x1="12" y1="17" x2="12.01" y2="17" />
    </IconBase>
  );
}

export function MoonIcon(p: IconProps) {
  return (
    <IconBase {...p}>
      <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </IconBase>
  );
}
