package com.worklyindia.app

import android.Manifest
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import live.videosdk.rtc.android.Meeting
import live.videosdk.rtc.android.Participant
import live.videosdk.rtc.android.Stream
import live.videosdk.rtc.android.VideoSDK
import live.videosdk.rtc.android.VideoView
import live.videosdk.rtc.android.listeners.MeetingEventListener
import live.videosdk.rtc.android.listeners.ParticipantEventListener
import org.webrtc.VideoTrack

class NativeVideoSDKMeetingActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val meetingId = intent.getStringExtra(EXTRA_MEETING_ID).orEmpty()
        val token = intent.getStringExtra(EXTRA_TOKEN).orEmpty()
        val participantName = intent.getStringExtra(EXTRA_NAME).orEmpty().ifBlank { "Workly India user" }
        if (meetingId.isBlank() || token.isBlank()) {
            Toast.makeText(this, "VideoSDK meeting details missing.", Toast.LENGTH_LONG).show()
            finish()
            return
        }
        setContent {
            MaterialTheme {
                NativeVideoSDKMeetingScreen(meetingId, token, participantName, onLeave = { finish() })
            }
        }
    }

    companion object {
        const val EXTRA_MEETING_ID = "workly.videosdk.meeting_id"
        const val EXTRA_TOKEN = "workly.videosdk.token"
        const val EXTRA_NAME = "workly.videosdk.name"
    }
}

@Composable
private fun NativeVideoSDKMeetingScreen(
    meetingId: String,
    token: String,
    participantName: String,
    onLeave: () -> Unit
) {
    val context = LocalContext.current
    val participants = remember { mutableStateListOf<Participant>() }
    var meeting by remember { mutableStateOf<Meeting?>(null) }
    var micEnabled by remember { mutableStateOf(true) }
    var cameraEnabled by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var joining by remember { mutableStateOf(true) }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        if (result.values.all { it }) {
            joinNativeVideoSDKMeeting(
                meetingId, token, participantName,
                onMeeting = { meeting = it },
                onParticipants = { list -> participants.clear(); participants.addAll(list) },
                onError = { error = it },
                onJoined = { joining = false }
            )
        } else {
            error = "Camera and microphone permissions are required."
            joining = false
        }
    }

    LaunchedEffect(Unit) {
        val camera = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val microphone = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (camera && microphone) {
            joinNativeVideoSDKMeeting(
                meetingId, token, participantName,
                onMeeting = { meeting = it },
                onParticipants = { list -> participants.clear(); participants.addAll(list) },
                onError = { error = it },
                onJoined = { joining = false }
            )
        } else {
            permissionLauncher.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
        }
    }

    fun leaveCall() {
        meeting?.let {
            it.removeAllListeners()
            it.leave()
        }
        meeting = null
        onLeave()
    }
    BackHandler { leaveCall() }

    Column(Modifier.fillMaxSize().background(Color(0xFF101522))) {
        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Workly India • Video interview", Modifier.weight(1f), color = Color.White, style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = { leaveCall() }) { Text("Leave", color = Color.White) }
        }
        if (joining) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color.White)
            }
        } else if (error != null) {
            Box(Modifier.weight(1f).fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                Text(error ?: "Meeting error", color = Color.White)
            }
        } else if (participants.isEmpty()) {
            Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
                Text("Waiting for participants…", color = Color.White)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(if (participants.size == 1) 1 else 2),
                modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(participants, key = { it.id }) { participant ->
                    NativeVideoSDKParticipantTile(participant)
                }
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Button(onClick = {
                if (micEnabled) meeting?.muteMic() else meeting?.unmuteMic()
                micEnabled = !micEnabled
            }, enabled = meeting != null) { Text(if (micEnabled) "Mute" else "Unmute") }
            Button(onClick = {
                if (cameraEnabled) meeting?.disableWebcam() else meeting?.enableWebcam()
                cameraEnabled = !cameraEnabled
            }, enabled = meeting != null) { Text(if (cameraEnabled) "Camera off" else "Camera on") }
            Button(onClick = { leaveCall() }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFB3261E))) {
                Text("End")
            }
        }
    }
}

@Composable
private fun NativeVideoSDKParticipantTile(participant: Participant) {
    var videoTrack by remember(participant) { mutableStateOf(participant.streams.values.firstOrNull { it.kind == "video" }?.track as? VideoTrack) }
    DisposableEffect(participant) {
        val listener = object : ParticipantEventListener() {
            override fun onStreamEnabled(stream: Stream) {
                if (stream.kind == "video") videoTrack = stream.track as? VideoTrack
            }
            override fun onStreamDisabled(stream: Stream) {
                if (stream.kind == "video") videoTrack = null
            }
        }
        participant.addEventListener(listener)
        onDispose { participant.removeEventListener(listener) }
    }
    Column(Modifier.fillMaxWidth().background(Color.DarkGray, RoundedCornerShape(12.dp))) {
        AndroidView(
            factory = { VideoView(it) },
            update = { view ->
                if (view.tag != videoTrack) {
                    view.removeTrack()
                    videoTrack?.let { view.addTrack(it) }
                    view.tag = videoTrack
                }
            },
            onRelease = { view ->
                view.removeTrack()
                view.releaseSurfaceViewRenderer()
            },
            modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f)
        )
        Text(
            participant.displayName,
            Modifier.fillMaxWidth().padding(8.dp),
            color = Color.White
        )
    }
}

private fun joinNativeVideoSDKMeeting(
    meetingId: String,
    token: String,
    participantName: String,
    onMeeting: (Meeting) -> Unit,
    onParticipants: (List<Participant>) -> Unit,
    onError: (String) -> Unit,
    onJoined: () -> Unit
) {
    try {
        VideoSDK.config(token)
        val meeting = VideoSDK.initMeeting(
            null,
            meetingId,
            participantName,
            true,
            true,
            null,
            null,
            false,
            null,
            null,
            VideoSDK.PreferredProtocol.UDP_OVER_TCP
        )
        meeting.addEventListener(object : MeetingEventListener() {
            override fun onMeetingJoined() {
                val current = meeting.localParticipant
                onParticipants(listOf(current))
                onJoined()
            }
            override fun onParticipantJoined(participant: Participant) {
                onParticipants((meeting.participants.values.toList() + meeting.localParticipant).distinctBy { it.id })
            }
            override fun onParticipantLeft(participant: Participant) {
                onParticipants((meeting.participants.values.toList() + meeting.localParticipant).distinctBy { it.id })
            }
            override fun onMeetingLeft() {
                onParticipants(emptyList())
            }
            override fun onError(errorData: org.json.JSONObject) {
                onError(errorData.optString("message").ifBlank { "VideoSDK meeting error." })
                onJoined()
            }
        })
        onMeeting(meeting)
        meeting.join()
    } catch (e: Exception) {
        onError(e.message ?: "VideoSDK meeting join nahi ho saki.")
        onJoined()
    }
}
