import * as React from "react";
import { WebView, WebViewProps } from "react-native-webview";

interface WherebyEmbedProps extends WebViewProps {
    roomUrl: string;
    queryParams?: string;
}

const WherebyEmbed = React.forwardRef<React.ElementRef<typeof WebView>, WherebyEmbedProps>(
    ({ roomUrl, queryParams, ...props }: WherebyEmbedProps, ref) => {
        const url = queryParams ? `${roomUrl}?${queryParams}` : roomUrl;

        return (
            <WebView
                ref={ref}
                source={{ uri: url }}
                startInLoadingState
                originWhitelist={["*"]}
                mediaPlaybackRequiresUserAction={false}
                // iOS specific:
                allowsInlineMediaPlayback
                // Android specific:
                javaScriptEnabled
                domStorageEnabled
                {...props}
            />
        );
    },
);

type WherebyEmbedRef = React.ElementRef<typeof WebView>;

export { WherebyEmbed, type WherebyEmbedRef };
