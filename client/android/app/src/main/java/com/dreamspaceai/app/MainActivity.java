package com.dreamspaceai.app;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The app and API use different HTTPS origins. Secure SameSite=None session cookies
        // are needed for authenticated API requests from this WebView.
        CookieManager.getInstance().setAcceptThirdPartyCookies(bridge.getWebView(), true);
    }
}
