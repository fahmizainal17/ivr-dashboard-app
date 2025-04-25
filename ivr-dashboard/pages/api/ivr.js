const { google } = require('googleapis');
const { parse } = require('csv-parse');
const fs = require('fs');

export default async function handler(req, res) {
  try {
    // Authenticate with a service account
    const credentials = JSON.parse(fs.readFileSync('service-account.json'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // Get folder ID from environment variable
    const folderId = process.env.DRIVE_FOLDER_ID || 'your_folder_id_here';

    // List CSV files
    const fileResponse = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='text/csv'`,
      fields: 'files(id, name, modifiedTime)',
    });
    const files = fileResponse.data.files || [];

    let dfList = [];
    let phonenumList = [];
    let totalCallsMade = [];
    let totalOfPickups = [];

    // Process each CSV file
    for (const file of files) {
      const fileId = file.id;
      const fileStream = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      // Parse CSV
      const records = [];
      await new Promise((resolve, reject) => {
        fileStream.data
          .pipe(parse({ skip_lines: 1, columns: true, trim: true }))
          .on('data', (record) => {
            records.push(record);
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Process records
      let df = records.map((row, index) => {
        const newRow = {};
        Object.keys(row).forEach((key, i) => {
          newRow[i] = row[key];
        });
        return newRow;
      });

      // Extract PhoneNo and UserKeyPress columns
      const dfPhonenum = df.map(row => ({ 0: row['PhoneNo'] }));
      const dfResponse = df.map(row => {
        const newRow = {};
        let started = false;
        Object.keys(row).forEach(key => {
          if (key === 'UserKeyPress') started = true;
          if (started) newRow[key] = row[key];
        });
        return newRow;
      });

      const dfResults = dfPhonenum.map((row, i) => ({
        ...row,
        ...dfResponse[i],
      }));

      // Total calls made
      const totalCallMade = dfResults.length;
      totalCallsMade.push(totalCallMade);

      // Append phone numbers
      phonenumList.push(dfPhonenum);

      // Filter responses (similar to Python logic)
      let dfComplete = dfResults;
      if (dfComplete.length > 0 && Object.keys(dfComplete[0]).length > 2) {
        dfComplete = dfComplete.filter(row => {
          const keyPress = row['UserKeyPress'] || '';
          return keyPress.length === 10;
        });
      } else {
        dfComplete = [];
      }

      dfList.push(dfComplete);

      // Total pickups
      const totalOfPickup = dfComplete.length;
      totalOfPickups.push(totalOfPickup);
    }

    // Merge data
    const dfMerge = dfList.flat();
    const phonenumCombined = dfList.flat().map(row => ({ phonenum: row[0] }));

    // Calculate metrics
    const totalFiles = files.length;
    const totalCalls = totalCallsMade.reduce((a, b) => a + b, 0);
    const totalPickups = totalOfPickups.reduce((a, b) => a + b, 0);
    const pickupRate = totalCalls > 0 ? (totalPickups / totalCalls) * 100 : 0;
    const dfCr = dfMerge.filter(row => Object.values(row).every(val => val !== '' && val !== null));
    const crRate = totalPickups > 0 ? (dfCr.length / totalPickups) * 100 : 0;

    // Handle duplicates
    const uniqueResponses = [];
    const seen = new Set();
    for (const row of dfMerge) {
      const key = JSON.stringify(row);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResponses.push(row);
      }
    }

    const totalResponses = dfMerge.length;
    const duplicated = totalResponses - uniqueResponses.length;
    const totalResponsesAfter = uniqueResponses.length;

    // Response
    const response = {
      total_files: totalFiles,
      total_calls_made: totalCalls,
      total_pickups: totalPickups,
      pickup_rate: parseFloat(pickupRate.toFixed(2)),
      cr_rate: parseFloat(crRate.toFixed(2)),
      total_responses: totalResponses,
      duplicated: duplicated,
      total_responses_after: totalResponsesAfter,
      data: uniqueResponses,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
