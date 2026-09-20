import { Subject, AttendanceDayDoc } from '../types/attendance';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

interface SpreadsheetCreationResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}

/**
 * Creates a brand new Attendzy Live Attendance Spreadsheet in the user's Google Drive / Gmail account.
 */
export async function createAttendanceSpreadsheet(
  accessToken: string,
  studentName?: string
): Promise<SpreadsheetCreationResult> {
  const title = `Attendzy - Live Attendance (${studentName || 'My College Attendance'})`;

  const payload = {
    properties: {
      title,
      locale: 'en_US',
      autoRecalc: 'ON_CHANGE',
    },
    sheets: [
      {
        properties: {
          sheetId: 0,
          title: 'Live Subject Stats',
          gridProperties: {
            frozenRowCount: 3,
            columnCount: 10,
            rowCount: 100,
          },
        },
      },
      {
        properties: {
          sheetId: 1,
          title: 'Daily Attendance Log',
          gridProperties: {
            frozenRowCount: 1,
            columnCount: 8,
            rowCount: 1000,
          },
        },
      },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData?.error?.message || `Failed to create Google Spreadsheet (${res.status})`;
    throw new Error(message);
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return {
    spreadsheetId,
    spreadsheetUrl,
    title,
  };
}

/**
 * Syncs the latest live app stats and logs to the user's connected Google Spreadsheet.
 */
export async function syncAttendanceToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  subjects: Subject[],
  attendanceDocs: AttendanceDayDoc[],
  targetPercentage: number = 75,
  studentName?: string
): Promise<{ success: boolean; syncedAt: string }> {
  const syncedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // 1. Prepare "Live Subject Stats" rows
  let overallAttended = 0;
  let overallTotal = 0;

  const subjectRows: any[][] = [];

  // Title Banner
  subjectRows.push([
    'ATTENDZY LIVE ATTENDANCE & ANALYTICS DASHBOARD',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  // Metadata row
  subjectRows.push([
    `Student: ${studentName || 'Student'}`,
    '',
    `Target Criteria: ${targetPercentage}%`,
    '',
    `Last Live Synced: ${syncedAt}`,
    '',
    'App: Attendzy',
    '',
    '',
  ]);

  // Table Headers
  subjectRows.push([
    'Subject Code',
    'Subject Name',
    'Faculty / Teacher',
    'Attended Classes',
    'Total Conducted',
    'Attendance %',
    'Target %',
    'Current Status',
    'Attendance Advice / Safe Skips',
  ]);

  for (const sub of subjects) {
    const total = Number(sub.totalClasses) || 0;
    const attended = Number(sub.attendedClasses) || 0;
    overallTotal += total;
    overallAttended += attended;

    const pct = total > 0 ? (attended / total) * 100 : 0;
    const isAboveTarget = pct >= targetPercentage;

    let status = 'NO CLASSES YET';
    let advice = 'No classes recorded yet';

    if (total > 0) {
      if (isAboveTarget) {
        status = 'ON TRACK (ABOVE TARGET)';
        const maxCanMiss = Math.floor(
          (attended - (targetPercentage / 100) * total) / (targetPercentage / 100)
        );
        advice =
          maxCanMiss > 0
            ? `You can safely miss ${maxCanMiss} upcoming class${maxCanMiss > 1 ? 'es' : ''}`
            : 'At threshold: do not miss next class';
      } else {
        status = 'ATTENDANCE SHORTAGE';
        const needed = Math.ceil(
          ((targetPercentage / 100) * total - attended) / (1 - targetPercentage / 100)
        );
        advice = `Must attend next ${needed} consecutive class${needed > 1 ? 'es' : ''} to reach ${targetPercentage}%`;
      }
    }

    subjectRows.push([
      sub.code || 'N/A',
      sub.name,
      sub.teacher || 'Faculty',
      attended,
      total,
      `${pct.toFixed(1)}%`,
      `${targetPercentage}%`,
      status,
      advice,
    ]);
  }

  // Blank spacer row
  subjectRows.push(['', '', '', '', '', '', '', '', '']);

  // Overall Summary row
  const overallPct = overallTotal > 0 ? (overallAttended / overallTotal) * 100 : 0;
  const overallStatus =
    overallTotal === 0
      ? 'NO CLASSES YET'
      : overallPct >= targetPercentage
      ? 'ELIGIBLE (ON TRACK)'
      : 'SHORTAGE (ACTION REQUIRED)';

  subjectRows.push([
    'OVERALL TOTALS',
    'ALL SUBJECTS COMBINED',
    '-',
    overallAttended,
    overallTotal,
    `${overallPct.toFixed(1)}%`,
    `${targetPercentage}%`,
    overallStatus,
    overallPct >= targetPercentage
      ? 'Great job keeping attendance above quota!'
      : `Shortage of ${(targetPercentage - overallPct).toFixed(1)}% below required criteria`,
  ]);

  // 2. Prepare "Daily Attendance Log" rows
  const logRows: any[][] = [];
  logRows.push([
    'Date',
    'Day',
    'Subject',
    'Status',
    'Time Window',
    'Is Day Off / Holiday',
    'Notes / Remarks',
  ]);

  const sortedDocs = [...attendanceDocs].sort((a, b) => b.date.localeCompare(a.date));

  for (const doc of sortedDocs) {
    const dateObj = new Date(doc.date + 'T00:00:00');
    const dayName = isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    if (doc.isDayOff) {
      logRows.push([
        doc.date,
        dayName,
        'Holiday / Day Off',
        'DAY OFF',
        'All Day',
        'TRUE',
        doc.dayOffReason || 'College / Personal Day Off',
      ]);
      continue;
    }

    if (doc.classes && doc.classes.length > 0) {
      doc.classes.forEach((c) => {
        const time = `${c.startTime || ''} - ${c.endTime || ''}`.trim();
        logRows.push([
          doc.date,
          dayName,
          c.subjectName || 'Unknown Subject',
          c.status ? c.status.toUpperCase() : 'UNMARKED',
          time === '-' ? '' : time,
          'FALSE',
          c.note || '',
        ]);
      });
    }
  }

  // 3. Clear existing ranges to prevent residual rows
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Live Subject Stats'!A1:Z500:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch((e) => console.warn('Warning clearing subject stats sheet:', e));

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Daily Attendance Log'!A1:Z5000:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  ).catch((e) => console.warn('Warning clearing log sheet:', e));

  // 4. Batch update values to Google Sheet
  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: "'Live Subject Stats'!A1",
            values: subjectRows,
          },
          {
            range: "'Daily Attendance Log'!A1",
            values: logRows,
          },
        ],
      }),
    }
  );

  if (!updateRes.ok) {
    const errorData = await updateRes.json().catch(() => ({}));
    const message = errorData?.error?.message || `Failed to update spreadsheet (${updateRes.status})`;
    throw new Error(message);
  }

  // 5. Apply header styling format (Navy blue header background, white text, bold)
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // Header formatting for Live Subject Stats table (Row 3, 0-indexed row 2)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.06, green: 0.09, blue: 0.15 }, // Slate 900
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'LEFT',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Header formatting for Daily Attendance Log (Row 1, 0-indexed row 0)
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.06, green: 0.09, blue: 0.15 }, // Slate 900
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                  horizontalAlignment: 'LEFT',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Banner formatting for Row 1
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.94, green: 0.96, blue: 0.98 },
                  textFormat: { bold: true, fontSize: 13, foregroundColor: { red: 0.09, green: 0.12, blue: 0.17 } },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      }),
    });
  } catch (fmtErr) {
    console.warn('Optional format update skipped:', fmtErr);
  }

  return { success: true, syncedAt };
}
