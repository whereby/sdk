import { useTheme as useEmotionTheme } from "@emotion/react";

const color = {
    brand100: "#E1D9F3",
    brand200: "#C3B3E8",
    brand300: "#A58DDC",
    brand400: "#8766D1",
    brand500: "#6941C6",
    brand600: "#54349E",
    brand700: "#3F2776",
    brand800: "#2A1A4F",
    brand900: "#1F133B",
    brand1000: "#150D27",
    neutral100: "#FFFFFF",
    neutral200: "#F1F2F3",
    neutral300: "#E4E6E8",
    neutral400: "#BCC1C6",
    neutral500: "#949CA3",
    neutral600: "#616970",
    neutral700: "#494F54",
    neutral800: "#303438",
    neutral900: "#181A1C",
    neutral1000: "#000000",
    feedback100: "#12B76A",
    feedback200: "#D1FADF",
    feedback300: "#3348FF",
    feedback400: "#EBF1FF",
    feedback500: "#E74ABB",
    feedback600: "#FFCCE0",
    feedback700: "#F79009",
    feedback800: "#FEEFC6",
    feedback900: "#F04438",
    feedback1000: "#FEE4E2",

    blue: "#2b189b",
    blueLight: "#4141e1",
    blueTransparent: "rgba(43, 24, 155, 0.24)",
    blueDark: "#211375",
    blueExtraDark: "#190f57",
    greenExtraLight: "#00a757",
    greenLight: "#00934d",
    green: "#006654",
    greenDark: "#0c5b4c",
    greenExtraDark: "#0a5345",
    redLight: "#f26b4d",
    red: "#c35037",
    redDark: "#b5432b",
    redExtraDark: "#a03620",
    greyExtraLight: "rgba(0, 0, 0, 0.12)",
    greyLight: "rgba(0, 0, 0, 0.24)",
    grey: "rgba(0, 0, 0, 0.56)",
    greyDark: "rgba(0, 0, 0, 0.6)",
    greyExtraDark: "rgba(0, 0, 0, 0.72)",
    black: "#000",
    backgroundGrey: "#f4f4f4",
    backgroundYellow: "#f8e3c8",
    backgroundPink: "#f8dbd5",
    backgroundInfoBlue: "#ace5f6",
    backgroundErrorRed: "#fb9782",
    backgroundWarningYellow: "#fcde6d",
    illustrationBlue: "#6a6feb",
    illustrationGreen: "#1b9c84",
    illustrationRed: "#ff7e6c",
    mainText: "#000",
    primary: "#2b189b",
    secondary: "#006654",
    negative: "#c35037",
    meetingRed: "#f26b4d",
};

const fontWeight = {
    normal: 400,
    medium: 500,
    bold: 600,
};

const fontSize = {
    extraSmall: "12px",
    small: "14px",
    normal: "16px",
    large: "18px",
    subHeadlineSmall: "24px",
    subHeadlineNormal: "28px",
    subHeadlineLarge: "46px",
    headlineSmall: "40px",
    headlineNormal: "80px",
    headlineLarge: "120px",
};

const lineHeight = {
    extraSmall: "18px",
    small: "20px",
    normal: "24px",
    large: "26px",
    subHeadlineSmall: "32px",
    subHeadlineNormal: "38px",
    subHeadlineLarge: "46px",
    headlineSmall: "52px",
    headlineNormal: "90px",
    headlineLarge: "124px",
};

const borderRadius = {
    extraSmall: "4px",
    small: "8px",
    large: "12px",
    extraLarge: "16px",
};

const dropShadow = {
    small: "0px 1px 4px rgba(0, 0, 0, 0.16)",
    large: "0px 8px 16px rgba(0, 0, 0, 0.16), 0px 1px 4px rgba(0, 0, 0, 0.16)",
};

const spacing = {
    1: "4px",
    2: "8px",
    3: "16px",
    4: "24px",
    5: "32px",
    6: "40px",
    7: "64px",
    8: "96px",
    9: "128px",
    10: "192px",
};

const useTheme = () => {
    const theme = useEmotionTheme();

    return {
        color,
        fontSize,
        fontWeight,
        lineHeight,
        borderRadius,
        dropShadow,
        spacing,
        ...theme,
    };
};

export { color, fontWeight, fontSize, lineHeight, borderRadius, dropShadow, spacing, useTheme };
