package com.foodup.posup

import android.app.Presentation
import android.content.Context
import android.os.Bundle
import android.view.Display
import android.widget.FrameLayout
import com.facebook.react.ReactInstanceManager
import com.facebook.react.ReactRootView

/**
 * Hosts the "CustomerDisplay" registered React component on the second
 * screen. Reuses the SAME ReactInstanceManager/JS instance already
 * running the main POS screen -- this is what lets the customer
 * display store (lib/customerDisplayStore.ts) work unchanged, since
 * both screens share one JS process.
 */
class CustomerDisplayPresentation(
    outerContext: Context,
    display: Display,
    private val reactInstanceManager: ReactInstanceManager
) : Presentation(outerContext, display) {

    private var reactRootView: ReactRootView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val rootView = ReactRootView(context)
        reactRootView = rootView

        rootView.startReactApplication(
            reactInstanceManager,
            "CustomerDisplay",
            null
        )

        val container = FrameLayout(context)
        container.addView(rootView)
        setContentView(container)
    }

    override fun onStop() {
        reactRootView?.unmountReactApplication()
        reactRootView = null
        super.onStop()
    }
}