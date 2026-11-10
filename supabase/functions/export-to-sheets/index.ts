import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  parseServiceAccountKey,
  getGoogleAccessToken,
  GOOGLE_SCOPES,
  corsHeaders
} from "../_shared/googleAuth.ts";
import { getOwnerSecretJson } from "../_shared/ownerSecrets.ts";

// Fixed Sheet ID - shared with service account
const SPREADSHEET_ID = "1pjww-v9Rax51HnwFIIETphZvyOJZLnPEwgLGCNi1Jc4";

interface ApplicantData {
  name: string;
  email: string;
  phone: string;
  position: string;
  company: string;
  location: string;
  skills: string;
  status: string;
  appliedDate: string;
}

interface WalletTransactionData {
  date: string;
  time: string;
  type: string;
  description: string;
  points: string;
  amount: string;
  status: string;
}

interface RequestBody {
  applicants?: ApplicantData[];
  transactions?: WalletTransactionData[];
  jobTitle: string;
  exportType?: 'applicants' | 'wallet';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { applicants, transactions, jobTitle, exportType }: RequestBody = await req.json();

    // Determine export type
    const isWalletExport = exportType === 'wallet' || transactions !== undefined;

    if (isWalletExport) {
      if (!transactions || transactions.length === 0) {
        throw new Error('No transaction data provided');
      }
      console.log(`Adding ${transactions.length} wallet transactions to Google Sheet`);
    } else {
      if (!applicants || applicants.length === 0) {
        throw new Error('No applicants data provided');
      }
      console.log(`Adding ${applicants.length} applicants for ${jobTitle} to Google Sheet`);
    }

    // Parse service account key — prefer owner-saved Sheets secret, fall back to env
    let serviceAccount: any = await getOwnerSecretJson('GOOGLE_SHEETS_API_JSON');
    if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
      serviceAccount = parseServiceAccountKey();
    }

    // Get access token with Sheets scope only
    const accessToken = await getGoogleAccessToken(serviceAccount, [
      GOOGLE_SCOPES.SHEETS
    ]);

    // Create a new sheet tab for this export - use jobTitle if provided for uniqueness
    // Remove special characters that Google Sheets doesn't allow in tab names (: / \ ? * [ ])
    const rawTitle = jobTitle 
      ? jobTitle 
      : (isWalletExport 
          ? `Wallet Statement - ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
          : `Export - ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    
    // Sanitize sheet title - remove invalid characters
    const sheetTitle = rawTitle.replace(/[:\\/\?\*\[\]]/g, '-').substring(0, 100);
    
    console.log(`Creating new sheet tab: ${sheetTitle}`);
    console.log(`Data to be added:`, { rowCount: isWalletExport ? transactions?.length : applicants?.length });

    // First, add a new sheet tab
    const addSheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            addSheet: {
              properties: {
                title: sheetTitle,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          }]
        })
      }
    );

    let newSheetId = 0;
    let useSheetTitle = sheetTitle;
    
    if (addSheetResponse.ok) {
      const addSheetData = await addSheetResponse.json();
      newSheetId = addSheetData.replies?.[0]?.addSheet?.properties?.sheetId || 0;
      console.log(`New sheet tab created with ID: ${newSheetId}`);
    } else {
      const errorText = await addSheetResponse.text();
      console.warn('Could not create new sheet tab:', errorText);
      
      // If sheet name exists, add timestamp suffix and try again
      const retryTitle = `${sheetTitle.substring(0, 80)}_${Date.now()}`;
      console.log(`Retrying with new title: ${retryTitle}`);
      
      const retryResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [{
              addSheet: {
                properties: {
                  title: retryTitle,
                  gridProperties: { frozenRowCount: 1 }
                }
              }
            }]
          })
        }
      );
      
      if (retryResponse.ok) {
        const retryData = await retryResponse.json();
        newSheetId = retryData.replies?.[0]?.addSheet?.properties?.sheetId || 0;
        useSheetTitle = retryTitle;
        console.log(`Retry successful, new sheet ID: ${newSheetId}`);
      } else {
        console.error('Retry also failed, will write to first sheet');
      }
    }

    // Prepare data for the sheet based on export type
    let headers: string[];
    let rows: string[][];
    let columnCount: number;

    if (isWalletExport && transactions) {
      // Wallet statement headers - Status column for member status, Amount for earnings
      headers = ['Date', 'Time', 'Type', 'Description', 'Status', 'Amount'];
      rows = transactions.map(t => [
        t.date || '',
        t.time || '',
        t.type || '',
        t.description || '',
        t.points || t.status || '',
        t.amount || ''
      ]);
      columnCount = 6;
    } else if (applicants) {
      // Applicants headers
      headers = ['Name', 'Email', 'Phone', 'Position', 'Company', 'Location', 'Skills', 'Status', 'Applied Date'];
      rows = applicants.map(a => [
        a.name || '',
        a.email || '',
        a.phone || '',
        a.position || '',
        a.company || '',
        a.location || '',
        a.skills || '',
        a.status || '',
        a.appliedDate || ''
      ]);
      columnCount = 9;
    } else {
      throw new Error('No valid data provided');
    }

    const values = [headers, ...rows];
    console.log(`Prepared ${rows.length} data rows with ${headers.length} columns`);

    // Add data to the new sheet tab - use useSheetTitle which may have been updated
    const range = `'${useSheetTitle}'!A1`;
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: values
        })
      }
    );

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error('Failed to add data:', error);
      throw new Error(`Failed to add data to spreadsheet: ${error}`);
    }

    console.log('Data added successfully');

    // Format header row (bold, background color)
    const formatRequests = [
      {
        repeatCell: {
          range: {
            sheetId: newSheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.545, green: 0.361, blue: 0.965 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true
              }
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)'
        }
      },
      // Auto-resize all columns to fit content
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: newSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: columnCount
          }
        }
      },
      // Set minimum column widths for better readability
      {
        updateDimensionProperties: {
          range: {
            sheetId: newSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: columnCount
          },
          properties: {
            pixelSize: 130
          },
          fields: 'pixelSize'
        }
      }
    ];

    // Add wallet-specific column widths
    if (isWalletExport) {
      formatRequests.push(
        // Description column (index 3) - wider
        {
          updateDimensionProperties: {
            range: {
              sheetId: newSheetId,
              dimension: 'COLUMNS',
              startIndex: 3,
              endIndex: 4
            },
            properties: {
              pixelSize: 280
            },
            fields: 'pixelSize'
          }
        }
      );
    } else {
      // Applicants-specific column widths
      formatRequests.push(
        // Name column (index 0)
        {
          updateDimensionProperties: {
            range: {
              sheetId: newSheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 1
            },
            properties: {
              pixelSize: 200
            },
            fields: 'pixelSize'
          }
        },
        // Email column (index 1)
        {
          updateDimensionProperties: {
            range: {
              sheetId: newSheetId,
              dimension: 'COLUMNS',
              startIndex: 1,
              endIndex: 2
            },
            properties: {
              pixelSize: 250
            },
            fields: 'pixelSize'
          }
        },
        // Location column (index 5)
        {
          updateDimensionProperties: {
            range: {
              sheetId: newSheetId,
              dimension: 'COLUMNS',
              startIndex: 5,
              endIndex: 6
            },
            properties: {
              pixelSize: 200
            },
            fields: 'pixelSize'
          }
        },
        // Skills column (index 6)
        {
          updateDimensionProperties: {
            range: {
              sheetId: newSheetId,
              dimension: 'COLUMNS',
              startIndex: 6,
              endIndex: 7
            },
            properties: {
              pixelSize: 300
            },
            fields: 'pixelSize'
          }
        }
      );
    }

    const formatResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: formatRequests
        })
      }
    );

    if (!formatResponse.ok) {
      console.warn('Failed to format spreadsheet, but data was added successfully');
    }

    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit#gid=${newSheetId}`;
    console.log(`Successfully exported to: ${spreadsheetUrl}`);

    const recordCount = isWalletExport ? (transactions?.length || 0) : (applicants?.length || 0);
    const recordType = isWalletExport ? 'transactions' : 'applicants';

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheetUrl: spreadsheetUrl,
        spreadsheetId: SPREADSHEET_ID,
        sheetTitle: useSheetTitle,
        message: `Added ${recordCount} ${recordType} to Google Sheet`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to export to Google Sheets';
    console.error('Error in export-to-sheets function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
