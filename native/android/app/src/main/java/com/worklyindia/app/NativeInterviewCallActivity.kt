package com.worklyindia.app

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import live.videosdk.rtc.android.Participant
import live.videosdk.rtc.android.RTCStream
import live.videosdk.rtc.android.Room
import live.videosdk.rtc.android.VideoSDK
import live.videosdk.rtc.android.VideoView
import live.videosdk.rtc.android.lib.VideoSDKError
import videosdk.org.webrtc.VideoTrack
import live.videosdk.rtc.android.listeners.ParticipantEventListener
import live.videosdk.rtc.android.listeners.RoomEventListener
class NativeInterviewCallActivity : FragmentActivity() {
    private var room: Room? = null
    private lateinit var status: TextView
    private lateinit var tiles: LinearLayout
    private lateinit var micButton: Button
    private lateinit var cameraButton: Button
    private val videoViews = mutableMapOf<String, VideoView>()
    private val participantListeners = mutableMapOf<String, ParticipantEventListener>()
    private var micEnabled = true
    private var cameraEnabled = true
    private var joined = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val meetingId = intent.getStringExtra(EXTRA_MEETING_ID).orEmpty()
        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        val name = intent.getStringExtra(EXTRA_NAME).orEmpty().ifBlank { "Workly User" }
        if (meetingId.isBlank() || token.isBlank() || meetingId.length > 256 || token.length > 8192) {
            Toast.makeText(this, "Interview access is invalid. Please rejoin from Workly India.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        buildUi()
        if (!hasMediaPermissions()) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO), REQUEST_MEDIA)
        } else {
            joinVideoSdk(meetingId, token, name)
        }
    }

    private fun buildUi() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.rgb(9, 15, 28))
            setPadding(dp(14), dp(18), dp(14), dp(14))
        }
        status = TextView(this).apply {
            text = "Connecting to interview…"
            textSize = 16f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(14))
        }
        tiles = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }
        root.addView(status, LinearLayout.LayoutParams(-1, dp(52)))
        root.addView(tiles, LinearLayout.LayoutParams(-1, 0, 1f))
        val controls = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            orientation = LinearLayout.HORIZONTAL
        }
        micButton = controlButton("Mute")
        cameraButton = controlButton("Camera off")
        val leaveButton = controlButton("Leave").apply {
            setBackgroundColor(Color.rgb(190, 40, 55))
            setOnClickListener { leaveCall() }
        }
        micButton.setOnClickListener { toggleMic() }
        cameraButton.setOnClickListener { toggleCamera() }
        controls.addView(micButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { marginEnd = dp(6) })
        controls.addView(cameraButton, LinearLayout.LayoutParams(0, dp(52), 1f).apply { marginEnd = dp(6) })
        controls.addView(leaveButton, LinearLayout.LayoutParams(0, dp(52), 1f))
        root.addView(controls, LinearLayout.LayoutParams(-1, dp(64)))
        setContentView(root)
    }

    private fun controlButton(label: String) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(38, 52, 75))
    }

    private fun joinVideoSdk(meetingId: String, token: String, name: String) {
        try {
            VideoSDK.initialize(applicationContext)
            val createdRoom = VideoSDK.createRoom(
                roomId = meetingId,
                token = token,
                participantName = name,
                micEnabled = true,
                camEnabled = true
            )
            room = createdRoom
            createdRoom.addEventListener(object : RoomEventListener() {
                override fun onRoomJoined(switchRoomId: String?) {
                    joined = true
                    status.text = "Interview connected"
                    renderParticipant(createdRoom.localParticipant, "You")
                    createdRoom.participants.values.forEach { renderParticipant(it, it.displayName) }
                }

                override fun onParticipantJoined(participant: Participant) {
                    renderParticipant(participant, participant.displayName)
                    status.text = "Connected • ${createdRoom.participants.size + 1} participant(s)"
                }

                override fun onParticipantLeft(participant: Participant, reason: live.videosdk.rtc.android.lib.LeaveReason) {
                    removeParticipant(participant.id)
                    status.text = "Participant left"
                }

                override fun onRoomLeft(reason: live.videosdk.rtc.android.lib.LeaveReason) {
                    joined = false
                    finish()
                }

                override fun onError(error: live.videosdk.rtc.android.lib.VideoSDKError) {
                    runOnUiThread {
                        status.text = error.message ?: "Call connection error"
                        Toast.makeText(this@NativeInterviewCallActivity, status.text, Toast.LENGTH_LONG).show()
                    }
                }
            })
            lifecycleScope.launch {
                try {
                    createdRoom.join()
                } catch (error: Exception) {
                    status.text = error.message ?: "Could not join interview"
                    Toast.makeText(this@NativeInterviewCallActivity, status.text, Toast.LENGTH_LONG).show()
                }
            }
        } catch (error: Exception) {
            status.text = error.message ?: "Could not start native calling"
            Toast.makeText(this, status.text, Toast.LENGTH_LONG).show()
        }
    }

    private fun renderParticipant(participant: Participant, label: String) {
        if (videoViews.containsKey(participant.id)) return
        val tile = FrameLayout(this).apply { setBackgroundColor(Color.rgb(25, 35, 52)) }
        val video = VideoView(this)
        val caption = TextView(this).apply {
            text = label
            textSize = 13f
            setTextColor(Color.WHITE)
            setPadding(dp(10), dp(6), dp(10), dp(6))
            setBackgroundColor(0x88000000.toInt())
            layoutParams = FrameLayout.LayoutParams(-2, -2, Gravity.BOTTOM or Gravity.START)
        }
        tile.addView(video, FrameLayout.LayoutParams(-1, -1))
        tile.addView(caption)
        tiles.addView(tile, LinearLayout.LayoutParams(-1, 0, 1f).apply { bottomMargin = dp(8) })
        videoViews[participant.id] = video
        if (participant.isLocal) video.setMirror(true)
        val listener = object : ParticipantEventListener() {
            override fun onStreamEnabled(stream: RTCStream) {
                if (stream.kind == live.videosdk.rtc.android.MediaType.VIDEO) {
                    (stream.track as? VideoTrack)?.let { video.addTrack(it); video.visibility = View.VISIBLE }
                }
            }
            override fun onStreamDisabled(stream: RTCStream) {
                if (stream.kind == live.videosdk.rtc.android.MediaType.VIDEO) {
                    video.removeTrack()
                    video.visibility = View.INVISIBLE
                }
            }
        }
        participantListeners[participant.id] = listener
        participant.addEventListener(listener)
        participant.streams.values.firstOrNull { it.kind == live.videosdk.rtc.android.MediaType.VIDEO }
            ?.let { (it.track as? VideoTrack)?.let(video::addTrack) }
    }

    private fun removeParticipant(id: String) {
        participantListeners.remove(id)?.let { listener -> room?.participants?.get(id)?.removeEventListener(listener) }
        videoViews.remove(id)?.let { view ->
            view.removeTrack()
            (view.parent as? android.view.ViewGroup)?.removeView(view)
            view.releaseSurfaceViewRenderer()
        }
    }

    private fun toggleMic() {
        val current = room ?: return
        lifecycleScope.launch {
            try {
                if (current.isMicEnabled) current.muteMic() else current.unmuteMic()
                micEnabled = !current.isMicEnabled
                micButton.text = if (current.isMicEnabled) "Mute" else "Unmute"
            } catch (error: Exception) {
                Toast.makeText(this@NativeInterviewCallActivity, error.message ?: "Microphone control failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun toggleCamera() {
        val current = room ?: return
        lifecycleScope.launch {
            try {
                if (current.isCamEnabled) current.disableCam() else current.enableCam()
                cameraEnabled = current.isCamEnabled
                cameraButton.text = if (current.isCamEnabled) "Camera off" else "Camera on"
            } catch (error: Exception) {
                Toast.makeText(this@NativeInterviewCallActivity, error.message ?: "Camera control failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun leaveCall() {
        val current = room
        if (current == null) {
            finish()
        } else {
            lifecycleScope.launch {
                runCatching { current.leave() }
                joined = false
                finish()
            }
        }
    }

    private fun hasMediaPermissions() =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_MEDIA) return
        if (hasMediaPermissions()) {
            joinVideoSdk(intent.getStringExtra(EXTRA_MEETING_ID).orEmpty(), intent.getStringExtra(EXTRA_TOKEN).orEmpty(), intent.getStringExtra(EXTRA_NAME).orEmpty().ifBlank { "Workly User" })
        } else {
            Toast.makeText(this, "Camera and microphone permission are required for the interview.", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onDestroy() {
        participantListeners.forEach { (id, listener) -> room?.participants?.get(id)?.removeEventListener(listener) }
        videoViews.values.forEach { view -> runCatching { view.removeTrack(); view.releaseSurfaceViewRenderer() } }
        if (joined) lifecycleScope.launch { runCatching { room?.leave() } }
        window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        super.onDestroy()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    companion object {
        const val EXTRA_MEETING_ID = "meeting_id"
        const val EXTRA_TOKEN = "meeting_token"
        const val EXTRA_NAME = "participant_name"
        private const val REQUEST_MEDIA = 4102
    }
}
