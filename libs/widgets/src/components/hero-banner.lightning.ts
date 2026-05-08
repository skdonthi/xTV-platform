import { Lightning } from "@lightningjs/sdk";

export interface HeroBannerLightningProps {
  title: string;
  subtitle: string;
  image?: string;
}

export class HeroBannerLightning extends Lightning.Component {
  static override _template() {
    return {
      w: 1920,
      h: 1080,
      rect: true,
      color: 0xff07131f,
      Background: {
        w: 1920,
        h: 1080,
        alpha: 0.55,
      },
      Title: {
        x: 96,
        y: 360,
        text: {
          text: "Welcome",
          fontFace: "Arial",
          fontSize: 72,
          textColor: 0xfff5f8fb,
        },
      },
      Subtitle: {
        x: 96,
        y: 460,
        w: 760,
        text: {
          text: "",
          fontFace: "Arial",
          fontSize: 30,
          lineHeight: 42,
          textColor: 0xffd8e5ef,
        },
      },
    };
  }

  set props(props: HeroBannerLightningProps) {
    this.patch({
      Background: props.image ? { src: props.image } : {},
      Title: {
        text: {
          text: props.title,
        },
      },
      Subtitle: {
        text: {
          text: props.subtitle,
        },
      },
    });
  }

  override _focus() {
    this.patch({
      smooth: {
        scale: 1.02,
      },
    });
  }

  override _unfocus() {
    this.patch({
      smooth: {
        scale: 1,
      },
    });
  }
}
