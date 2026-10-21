package com.arcfit.app;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Capacitor SystemBars owns WindowInsets (bars, cutouts and keyboard).
        // Its WebView fallback prevents a second CSS inset on older WebViews.
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.BLACK), SystemBarStyle.dark(Color.BLACK));
    }
}
