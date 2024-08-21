import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const ROOM_URL = "";
const queryParams = "skipMediaPermissionPrompt";

export default function Room() {
    const wherebyRoomRef = React.useRef<WebView>(null);
    const scrollRef = React.useRef<ScrollView>(null);
    const [eventLogEntries, setEventLogEntries] = React.useState<any[]>([]);

    function handleWherebyEvent(event: any) {
        setEventLogEntries((prev) => [...prev, event]);
        scrollRef.current?.scrollToEnd({ animated: true });
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView ref={scrollRef} style={{ height: 50, flexGrow: 0 }}>
                {eventLogEntries.map((entry, index) => (
                    <Text key={index}>{entry}</Text>
                ))}
            </ScrollView>
            <View style={{ flex: 1, height: "100%" }}>
                <WebView
                    ref={wherebyRoomRef}
                    startInLoadingState
                    originWhitelist={["*"]}
                    style={styles.container}
                    source={{
                        uri: `${ROOM_URL}?${queryParams}`,
                    }}
                    mediaPlaybackRequiresUserAction={false}
                    // iOS specific:
                    allowsInlineMediaPlayback
                    // Android specific:
                    javaScriptEnabled
                    domStorageEnabled
                    onMessage={(event) => {
                        handleWherebyEvent(event.nativeEvent.data);
                    }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
