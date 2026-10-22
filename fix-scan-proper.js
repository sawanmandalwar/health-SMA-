const fs = require('fs');
let content = fs.readFileSync('src/app/scan.tsx', 'utf8');

// Find key positions
const fontCheckIdx = content.indexOf('if (!fontsLoaded) {');
const returnNullEnd = content.indexOf('return null;\n  }', fontCheckIdx);

// Find BottomTab component
const bottomTabStart = content.indexOf('  // ==================================================\n  // BOTTOM TAB\n  // ==================================================\n\n  const BottomTab = (', fontCheckIdx);
const bottomTabEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // DETAIL BOX', bottomTabStart);

// Find DetailBox component
const detailBoxEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // RETURN', bottomTabEnd);

// Find styles section
const stylesIdx = content.indexOf('\n\n// ====================================================\n// STYLES\n// ====================================================\n\nconst styles =');

// Extract components
const bottomTabComponent = content.substring(bottomTabStart, bottomTabEnd);
const detailBoxComponent = content.substring(bottomTabEnd + 1, detailBoxEnd);

// Build new component content (without internal components)
const beforeComponents = content.substring(0, returnNullEnd + 'return null;\n  }'.length);
const afterComponents = content.substring(detailBoxEnd);

// New content with components hoisted before styles
const externalComponents = `
// ====================================================
// BOTTOM TAB COMPONENT
// ====================================================

const BottomTab = ({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bottomTab,
        active && styles.bottomTabActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={active ? COLORS.primaryBlue : COLORS.secondaryText}
      />
      <Text
        style={[
          styles.bottomTabText,
          active && styles.bottomTabTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};


// ====================================================
// DETAIL BOX COMPONENT
// ====================================================

const DetailBox = ({
  label,
  value,
  isMobile,
}: {
  label: string;
  value: string;
  isMobile: boolean;
}) => {
  return (
    <View style={[styles.detailBox, isMobile && styles.detailBoxMobile]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};
`;

const newMainContent = beforeComponents + '\n\n  // ==================================================\n  // RETURN\n  // ==================================================\n\n  return (' + afterComponents;
const finalContent = newMainContent.substring(0, stylesIdx) + externalComponents + content.substring(stylesIdx);

fs.writeFileSync('src/app/scan.tsx', finalContent);
console.log('scan.tsx fixed!');