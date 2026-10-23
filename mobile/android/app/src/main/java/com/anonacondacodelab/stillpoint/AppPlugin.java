// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
package com.anonacondacodelab.stillpoint;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Native stand-ins for browser features that Android's WebView lacks. Nothing here uses the network. */
@CapacitorPlugin(
    name = "AppNative",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class AppPlugin extends Plugin {

    /* Links to websites and email open in the phone's browser or mail app (the app itself has no internet access). */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String u = call.getString("url", "");
        if (!(u.startsWith("https://") || u.startsWith("mailto:"))) { call.reject("unsupported link"); return; }
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(u));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "no app can open this link");
        }
    }

    /* Saving a file is two steps: pickSaveLocation opens Android's "save as" screen with only the file name (Android
       limits what a pending call may carry while that screen is open), then writeChunk writes the data in pieces. */
    @PluginMethod
    public void pickSaveLocation(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType(call.getString("mime", "application/json"));
        i.putExtra(Intent.EXTRA_TITLE, call.getString("name", "export.json"));
        startActivityForResult(call, i, "pickSaveLocationResult");
    }

    @ActivityCallback
    private void pickSaveLocationResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        r.put("uri", result.getResultCode() == Activity.RESULT_OK && uri != null ? uri.toString() : "");
        call.resolve(r);
    }

    private OutputStream openFile;

    @PluginMethod
    public void writeChunk(PluginCall call) {
        String u = call.getString("uri", "");
        boolean first = Boolean.TRUE.equals(call.getBoolean("first", false)), last = Boolean.TRUE.equals(call.getBoolean("last", false));
        try {
            if (first) {
                if (openFile != null) { try { openFile.close(); } catch (Exception ignored) {} }
                openFile = getContext().getContentResolver().openOutputStream(Uri.parse(u), "wt");
            }
            if (openFile == null) throw new Exception("could not open the file");
            openFile.write(call.getString("text", "").getBytes(StandardCharsets.UTF_8));
            if (last) { openFile.close(); openFile = null; }
            call.resolve();
        } catch (Exception e) {
            if (openFile != null) { try { openFile.close(); } catch (Exception ignored) {} openFile = null; }
            call.reject(e.getMessage() != null ? e.getMessage() : "write failed");
        }
    }

    @PluginMethod
    public void keepScreenOn(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", true));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }

    /* pattern as in the web Vibration API: [on, off, on, ...] in ms */
    @PluginMethod
    public void vibrate(PluginCall call) {
        try {
            JSArray a = call.getArray("pattern", new JSArray());
            long[] p = new long[a.length() + 1];
            for (int k = 0; k < a.length(); k++) p[k + 1] = a.getLong(k);
            Vibrator v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null && v.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(p, -1)); else v.vibrate(p, -1);
            }
        } catch (Exception ignored) {}
        call.resolve();
    }

    /* Spoken cues with the phone's own text-to-speech engine (works offline with an installed voice). */
    private TextToSpeech tts;
    private boolean ttsReady = false;

    private static Bundle fullVolume() {
        Bundle b = new Bundle();
        b.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1.0f);
        return b;
    }

    @PluginMethod
    public void speak(PluginCall call) {
        final String text = call.getString("text", "");
        if (tts == null) {
            tts = new TextToSpeech(getContext(), status -> {
                ttsReady = status == TextToSpeech.SUCCESS;
                if (ttsReady) {
                    tts.setLanguage(Locale.getDefault());
                    // media usage: the voice follows the media volume, like the beeps (sonification used the much quieter system volume)
                    tts.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
                    tts.speak(text, TextToSpeech.QUEUE_FLUSH, fullVolume(), "cue");
                }
            });
        } else if (ttsReady) tts.speak(text, TextToSpeech.QUEUE_FLUSH, fullVolume(), "cue");
        call.resolve();
    }

    /* Keeping a session running with the screen off: a foreground service with a partial wake lock. */
    @PluginMethod
    public void startActive(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "afterNotificationPermission");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void afterNotificationPermission(PluginCall call) { startService(call); }   // the service runs either way

    private void startService(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), ActiveService.class);
            i.putExtra("text", call.getString("text", "Session running"));
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "service failed");
        }
    }

    @PluginMethod
    public void stopActive(PluginCall call) {
        getContext().stopService(new Intent(getContext(), ActiveService.class));
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) { tts.shutdown(); tts = null; }
        super.handleOnDestroy();
    }
}
