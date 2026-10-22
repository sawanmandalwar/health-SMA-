const fs = require('fs');
let content = fs.readFileSync('src/app/scan.tsx', 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

const toRemove = `  // ==================================================
  // BOTTOM TAB
  // ==================================================

  const BottomTab = ({
    icon,
    label,
    active = false,
    onPress,
  }: {
    icon:
      keyof typeof Ionicons.glyphMap;

    label: string;

    active?: boolean;

    onPress: () => void;
  }) => {

    return (

      <Pressable
        onPress={onPress}

        style={[
          styles.bottomTab,

          active &&
            styles.bottomTabActive,
        ]}
      >

        <Ionicons
          name={icon}
          size={22}
          color={
            active
              ? COLORS.primaryBlue
              : COLORS.secondaryText
          }
        />

        <Text
          style={[
            styles.bottomTabText,

            active &&
              styles.bottomTabTextActive,
          ]}
        >
          {label}
        </Text>

      </Pressable>

    );
  };


  // ==================================================
  // DETAIL BOX
  // ==================================================

  const DetailBox = ({
    label,
    value,
  }: {
    label: string;
    value: string;
  }) => {

    return (

      <View
        style={[
          styles.detailBox,

          isMobile &&
            styles.detailBoxMobile,
        ]}
      >

        <Text
          style={
            styles.detailLabel
          }
        >
          {label}
        </Text>


        <Text
          style={
            styles.detailValue
          }
        >
          {value}
        </Text>

      </View>

    );
  };


  // ==================================================
  // RETURN
  // ==================================================

  return (`;

const toAdd = `  // ==================================================
  // RETURN
  // ==================================================

  return (`;

if (!content.includes(toRemove)) {
  console.error('Could not find the exact string to remove!');
  console.log('Looking for:', JSON.stringify(toRemove.substring(0, 100)));
  process.exit(1);
}

content = content.replace(toRemove, toAdd);

// Now add the components before styles
const stylesMarker = `\n\n// ====================================================\n// STYLES\n// ====================================================\n\nconst styles =`;

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

if (!content.includes(stylesMarker)) {
  console.error('Could not find styles marker!');
  process.exit(1);
}

content = content.replace(stylesMarker, externalComponents + stylesMarker);

// Write back with original line endings
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync('src/app/scan.tsx', content);
console.log('scan.tsx fixed!');