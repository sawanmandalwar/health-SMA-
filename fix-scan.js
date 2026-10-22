const fs = require('fs');
const content = fs.readFileSync('src/app/scan.tsx', 'utf8');

// Find the positions to modify
const fontCheckIdx = content.indexOf('if (!fontsLoaded) {');
const returnNullEnd = content.indexOf('return null;\n  }', fontCheckIdx);

// Extract the BottomTab component
const bottomTabIdx = content.indexOf('  // ==================================================\n  // BOTTOM TAB\n  // ==================================================\n\n  const BottomTab = (');
const bottomTabEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // DETAIL BOX', bottomTabIdx);
const detailBoxEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // RETURN', bottomTabEnd);

// The components to extract
const beforeComponents = content.substring(0, returnNullEnd + 'return null;\n  }'.length);
const afterComponents = content.substring(detailBoxEnd);

// External components to add before styles
const stylesIdx = content.indexOf('\n\n// ====================================================\n// STYLES\n// ====================================================\n\nconst styles =');
const beforeStyles = content.substring(0, stylesIdx);
const afterStyles = content.substring(stylesIdx);

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
}: {
  label: string;
  value: string;
}) => {
  return (
    <View style={[styles.detailBox, isMobile && styles.detailBoxMobile]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};
`;

const newContent = beforeComponents + '\n\n  // ==================================================\n  // RETURN\n  // ==================================================\n\n  return (' + afterComponents;
const finalContent = newContent.substring(0, stylesIdx) + externalComponents + afterStyles;

fs.writeFileSync('src/app/scan.tsx', finalContent);
console.log('Done!');