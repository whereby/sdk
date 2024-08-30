import * as React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WherebyEmbed, WherebyEmbedRef } from "@whereby.com/react-native-sdk/embed";
const ROOM_URL = "";

export default function Room() {
    const wherebyRoomRef = React.useRef<WherebyEmbedRef>(null);
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
