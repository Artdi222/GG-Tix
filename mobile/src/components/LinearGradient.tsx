import React, { useState } from 'react';
import { View, StyleSheet, Platform, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

export interface LinearGradientProps extends ViewProps {
  colors: readonly string[] | string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: readonly number[] | number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function LinearGradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 0, y: 1 },
  locations,
  style,
  children,
  ...props
}: LinearGradientProps) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });

  if (Platform.OS === 'web') {
    const startX = start?.x ?? 0;
    const startY = start?.y ?? 0;
    const endX = end?.x ?? 0;
    const endY = end?.y ?? 1;
    const angleDeg = Math.round((Math.atan2(endY - startY, endX - startX) * 180) / Math.PI) + 90;
    const gradientCss = `linear-gradient(${angleDeg}deg, ${colors.join(', ')})`;

    return (
      <View
        style={[
          styles.container,
          { backgroundImage: gradientCss } as any,
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

  const gradientId = `grad_${colors.join('_').replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setLayout({ width, height });
      }}
      {...props}
    >
      {layout.width > 0 && layout.height > 0 && (
        <Svg
          height={layout.height}
          width={layout.width}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Defs>
            <SvgLinearGradient
              id={gradientId}
              x1={`${(start?.x ?? 0) * 100}%`}
              y1={`${(start?.y ?? 0) * 100}%`}
              x2={`${(end?.x ?? 0) * 100}%`}
              y2={`${(end?.y ?? 1) * 100}%`}
            >
              {colors.map((color, index) => {
                const offset = locations
                  ? locations[index]
                  : colors.length > 1
                  ? index / (colors.length - 1)
                  : 0;
                return (
                  <Stop
                    key={index}
                    offset={`${offset * 100}%`}
                    stopColor={color}
                    stopOpacity={1}
                  />
                );
              })}
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      )}
      {children}
    </View>
  );
}

export default LinearGradient;

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
});
