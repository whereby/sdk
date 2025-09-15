import * as React from "react";
import { ScrollView, StyleSheet, Text, View, Alert, Platform, Button } from "react-native";
import { AudioModule } from "expo-audio";
import { Camera } from "expo-camera";
import { WherebyEmbed, type WherebyWebView, WherebyEvent } from "@whereby.com/react-native-sdk/embed";

const ROOM_URL = "";

export default function Room() {
    const wherebyRoomRef = React.useRef<WherebyWebView>(null);
    const scrollRef = React.useRef<ScrollView>(null);
    const [hasPermissionForAndroid, setHasPermissionForAndroid] = React.useState<boolean>(false);
    const [eventLogEntries, setEventLogEntries] = React.useState<WherebyEvent[]>([]);

    const handleWherebyEvent = (event: WherebyEvent) => {
        setEventLogEntries((prev) => [...prev, event]);
        scrollRef.current?.scrollToEnd({ animated: true });
    };

    React.useEffect(() => {
        (async () => {
            if (Platform.OS === "android") {
                const cameraStatus = await Camera.requestCameraPermissionsAsync();
                const audioStatus = await AudioModule.requestRecordingPermissionsAsync();

                if (cameraStatus.status === "granted" && audioStatus.status === "granted") {
                    setHasPermissionForAndroid(true);
                } else {
                    Alert.alert("Permissions Required", "Camera and microphone permissions are required.");
                    setHasPermissionForAndroid(false);
                }
            }
        })();
    }, []);

    if (Platform.OS === "android" && !hasPermissionForAndroid) {
        return <View />;
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView ref={scrollRef} style={{ height: 50, flexGrow: 0 }}>
                {eventLogEntries.map((entry, index) => (
                    <Text key={index}>
                        {entry.type} {entry.payload ? JSON.stringify(entry.payload) : ""}
                    </Text>
                ))}
            </ScrollView>
            <Button
                onPress={() => {
                    wherebyRoomRef.current?.knock();
                }}
                title="Knock"
            />
            <Button
                onPress={() => {
                    wherebyRoomRef.current?.openSettings("advanced");
                }}
                title="Open Settings"
            />
            <Button
                onPress={() => {
                    wherebyRoomRef.current?.toggleMicrophone();
                }}
                title="Toggle Microphone"
            />
            <View style={{ flex: 1, height: "100%" }}>
                <WherebyEmbed
                    ref={wherebyRoomRef}
                    style={styles.container}
                    room={ROOM_URL}
                    // Removes some UI elements. Useful for small screens.
                    minimal
                    // Skips the media permission prompt.
                    skipMediaPermissionPrompt
                    // Catch-all for any Whereby event
                    onWherebyMessage={(event) => {
                        handleWherebyEvent(event);
                    }}
                    // Specific callbacks for each Whereby event
                    onReady={() => {
                        // eslint-disable-next-line no-console
                        console.log("ready");
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
