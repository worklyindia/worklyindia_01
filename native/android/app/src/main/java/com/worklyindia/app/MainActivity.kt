package com.worklyindia.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private val WorklyGreen = Color(0xFF138A52)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = WorklyGreen)) {
                WorklyHome()
            }
        }
    }
}

@Composable
private fun WorklyHome() {
    var query by remember { mutableStateOf("") }
    Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF7F9F7)) {
        Column(
            modifier = Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "W",
                    modifier = Modifier.background(WorklyGreen, RoundedCornerShape(12.dp)).padding(10.dp),
                    color = Color.White,
                    fontWeight = FontWeight.Black
                )
                Column(modifier = Modifier.padding(start = 10.dp)) {
                    Text("Workly India", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text("Find work. Build your future.", color = Color.Gray, style = MaterialTheme.typography.bodySmall)
                }
            }

            Text("Your next opportunity starts here", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Discover jobs across India — including remote and work-from-home opportunities.", color = Color(0xFF59635D))

            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Job title, skill or company") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search jobs") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(20.dp)
            ) {
                Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Start with Workly", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                    Text("Explore roles that match your skills and goals.", color = Color(0xFF59635D))
                    Button(onClick = { /* Connect to live jobs in the next implementation step. */ }) {
                        Text("Explore jobs")
                    }
                }
            }

            Text("Popular categories", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryChip("Customer support")
                CategoryChip("IT & software")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryChip("Sales")
                CategoryChip("Work from home")
            }

            Spacer(modifier = Modifier.weight(1f))
            Text("Native Android • Workly India", color = Color.Gray, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun CategoryChip(label: String) {
    Surface(color = Color(0xFFE7F3EB), shape = RoundedCornerShape(50)) {
        Text(label, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp), color = WorklyGreen)
    }
}
