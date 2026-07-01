import Blits from "@lightningjs/blits";

// Blits (LightningJS canvas) hero banner. Props are passed from the layout node's
// props by the parent Application. Replaces the old DOM preview component.
export default Blits.Component("HeroBanner", {
  template: `
    <Element w="1920" h="1080" color="$background">
      <Element x="96" y="380">
        <Text content="$title" size="72" color="#f5f8fb" font="regular" />
        <Text content="$subtitle" y="120" size="30" color="#9db1c7" font="regular" />
      </Element>
    </Element>
  `,
  props: ["title", "subtitle", "background"],
});
