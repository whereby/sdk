import * as React from "react";
import { ScrollView, StyleSheet, Text, View, Alert, Platform } from "react-native";
import { WherebyEmbed, WherebyEmbedRef } from "@whereby.com/react-native-sdk/embed";
import { Audio } from "expo-av";
import { Camera } from 'expo-camera';

const ROOM_URL = "";

export default function Room() {
    const wherebyRoomRef = React.useRef<WherebyEmbedRef>(null);
    const scrollRef = React.useRef<ScrollView>(null);
    const [eventLogEntries, setEventLogEntries] = React.useState<any[]>([]);
    const [hasPermissionForAndroid, setHasPermissionForAndroid] = React.useState<boolean>(false);

    function handleWherebyEvent(event: any) {
        setEventLogEntries((prev) => [...prev, event]);
        scrollRef.current?.scrollToEnd({ animated: true });
    }

    React.useEffect(() => {
        (async () => {
            if (Platform.OS === 'android') {
                const cameraStatus = await Camera.requestCameraPermissionsAsync();
                const audioStatus = await Audio.requestPermissionsAsync();

                if (cameraStatus.status === 'granted' && audioStatus.status === 'granted') {
                    setHasPermissionForAndroid(true);
                } else {
                    Alert.alert("Permissions Required", "Camera and microphone permissions are required.");
                    setHasPermissionForAndroid(false);
                }
            }
        })();
    }, []);

    if (Platform.OS === 'android' && !hasPermissionForAndroid) {
        return <View />;
    }

    return (
        <View style={{ flex: 1 }}>
            <ScrollView ref={scrollRef} style={{ height: 50, flexGrow: 0 }}>
                {eventLogEntries.map((entry, index) => (
                    <Text key={index}>{entry}</Text>
                ))}
            </ScrollView>
            <View style={{ flex: 1, height: "100%" }}>
                <WherebyEmbed
                    ref={wherebyRoomRef}
                    style={styles.container}
                    room={ROOM_URL}
                    // Removes some UI elements. Useful for small screens.
                    minimal={"on"}
                    // Skips the media permission prompt.
                    skipMediaPermissionPrompt={"on"}
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
