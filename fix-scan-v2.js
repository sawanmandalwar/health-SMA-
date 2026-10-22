const fs = require('fs');
let content = fs.readFileSync('src/app/scan.tsx', 'utf8');

// Find the ScanScreen component end and styles start
const stylesIdx = content.indexOf('\n\n// ====================================================\n// STYLES\n// ====================================================\n\nconst styles =');
const componentEndIdx = content.lastIndexOf('}\n}\n\n// ====================================================\n// STYLES', stylesIdx);

// Find BottomTab component inside ScanScreen
const bottomTabStart = content.indexOf('  // ==================================================\n  // BOTTOM TAB\n  // ==================================================\n\n  const BottomTab = (', content.indexOf('export default function ScanScreen()'));
const bottomTabEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // DETAIL BOX', bottomTabStart);

// Find DetailBox component
const detailBoxEnd = content.indexOf('  };\n\n\n  // ==================================================\n  // RETURN', bottomTabEnd);

// Extract components
const bottomTabComponent = content.substring(bottomTabStart, bottomTabEnd);
const detailBoxComponent = content.substring(bottomTabEnd + 1, detailBoxEnd);

// Build new component content (without internal components)
const beforeComponents = content.substring(0, bottomTabStart);
const afterComponents = content.substring(detailBoxEnd);

// External components to add after ScanScreen component but before styles
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

const newContent = beforeComponents + afterComponents;
const finalContent = newContent.substring(0, componentEndIdx + 2) + externalComponents + content.substring(componentEndIdx + 2);

fs.writeFileSync('src/app/scan.tsx', finalContent);
console.log('scan.tsx fixed!');