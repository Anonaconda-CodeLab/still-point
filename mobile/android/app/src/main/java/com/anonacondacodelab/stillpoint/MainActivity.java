// Copyright (C) 2026 Anonaconda Code Lab · SPDX-License-Identifier: GPL-3.0-or-later
package com.anonacondacodelab.stillpoint;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPlugin.class);
        super.onCreate(savedInstanceState);
        // Back goes back inside the app; on the main screens, or while a session runs, the app moves to the background
        // instead of closing, so a session in progress is never ended by the Back button.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge == null || bridge.getWebView() == null) { moveTaskToBack(true); return; }
                bridge.getWebView().evaluateJavascript("(window.appBack && window.appBack()) ? 1 : 0", r -> {
                    if (!"1".equals(r)) moveTaskToBack(true);
                });
            }
        });
    }
}
