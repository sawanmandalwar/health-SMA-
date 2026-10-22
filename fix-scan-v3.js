const fs = require('fs');
let content = fs.readFileSync('src/app/scan.tsx', 'utf8');
content = content.replace(/\r\n/g, '\n');

// Find the start of BottomTab component
const bottomTabStart = content.indexOf('  // ==================================================\n  // BOTTOM TAB\n  // ==================================================\n\n  const BottomTab = (');
console.log('BottomTab start:', bottomTabStart);

// Find the end of DetailBox component (before RETURN)
const detailBoxEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // RETURN\n  // ==================================================\n\n  return (', bottomTabStart);
console.log('DetailBox end:', detailBoxEnd);

// Find styles marker
const stylesIdx = content.indexOf('\n\n// ====================================================\n// STYLES\n// ====================================================\n\nconst styles =');
console.log('Styles idx:', stylesIdx);

if (bottomTabStart >= 0 && detailBoxEnd >= 0 && stylesIdx >= 0) {
  console.log('All markers found!');
  
  // Build new content
  const before = content.substring(0, bottomTabStart);
  const after = content.substring(detailBoxEnd + '  };\n\n\n  // ==================================================\n  // RETURN\n  // ==================================================\n\n  return ('.length);
  
  const newMain = before + '  // ==================================================\n  // RETURN\n  // ==================================================\n\n  return (' + after;
  
  // Add external components
  const external = `
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

  const finalContent = newMain.substring(0, stylesIdx) + external + content.substring(stylesIdx);
  
  fs.writeFileSync('src/app/scan.tsx', finalContent.replace(/\n/g, '\r\n'));
  console.log('Fixed!');
} else {
  console.log('Markers not found');
}