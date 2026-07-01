import Blits from "@lightningjs/blits";

// Minimal Hello World screen. Uses the renderer's built-in sans-serif default
// font (no font asset needed). The caption shows tenant + platform so an
// on-device deploy confirms the right cruiseline/profile was built in.
export default Blits.Component("HelloWorld", {
  template: `
    <Element w="1920" h="1080" color="$background">
      <Text
        content="Hello World"
        font="Tempo Std"
        x="960" y="470"
        mount="{x: 0.5, y: 0.5}"
        size="120"
        color="#ffffff"
      />
      <Text
        content="$caption"
        font="Open Sans"
        x="960" y="620"
        mount="{x: 0.5, y: 0.5}"
        size="34"
        color="#9db1c7"
      />
    </Element>
  `,
  props: ["background", "caption"],
});
