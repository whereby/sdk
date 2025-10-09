#import <React/RCTBridgeModule.h>
#import <AVFoundation/AVFoundation.h>

@interface VoipAudioSession : NSObject <RCTBridgeModule>
@end

@implementation VoipAudioSession
RCT_EXPORT_MODULE();

RCT_REMAP_METHOD(setVoiceChatMode,
                 setVoiceChatModeWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  @try {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    NSError *error = nil;

    // Category + options
    BOOL ok = [session setCategory:AVAudioSessionCategoryPlayAndRecord
                       withOptions:(AVAudioSessionCategoryOptionAllowBluetooth |
                                   AVAudioSessionCategoryOptionAllowBluetoothA2DP |
                                   AVAudioSessionCategoryOptionDefaultToSpeaker)
                             error:&error];
    if (!ok) { reject(@"ERR_CATEGORY", error.localizedDescription, error); return; }

    // Mode = voiceChat (critical for VoIP/WebRTC)
    ok = [session setMode:AVAudioSessionModeVoiceChat error:&error];
    if (!ok) { reject(@"ERR_MODE", error.localizedDescription, error); return; }

    // Activate
    ok = [session setActive:YES error:&error];
    if (!ok) { reject(@"ERR_ACTIVE", error.localizedDescription, error); return; }

    resolve(@(YES));
  } @catch (NSException *exception) {
    reject(@"ERR_EXCEPTION", exception.reason, nil);
  }
}
@end
