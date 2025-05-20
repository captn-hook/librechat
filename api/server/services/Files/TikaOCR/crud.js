const fs = require('fs');
const axios = require('axios');
const { logger } = require('~/config');
const { logAxiosError } = require('~/utils/axios');


/**
 * Uploads a document to Apache Tika for OCR processing.
 *
 * @param {Object} params Upload parameters
 * @param {string} params.filePath The path to the file on disk
 * @param {string} params.apiKey Tika API key (not used, but kept for consistency)
 * @param {string} [params.baseURL=http://tika:9998] Tika API base URL
 * @returns {Promise<string>} The extracted text from the document
 */
async function uploadDocumentToTika({ filePath, baseURL = 'http://tika:9998/tika' }) {
  const fileData = fs.readFileSync(filePath); // Read the entire file into memory

  try {
    const response = await axios.put(baseURL, fileData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Accept': 'text/plain',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    // Ensure the response data is a string
    if (typeof response.data !== 'string') {
      throw new Error('Unexpected response format from Tika: Expected string');
    }

    return response.data; // Extracted text
  } catch (error) {
    logger.error('Error uploading document to Tika:', error.message);
    throw error;
  }
}

/**
 * Processes a file using Apache Tika OCR.
 *
 * @param {Object} params - The params object.
 * @param {ServerRequest} params.req - The request object from Express. It should have a `user` property with an `id`
 *                       representing the user
 * @param {Express.Multer.File} params.file - The file object, which is part of the request. The file object should
 *                                     have a `mimetype` property that tells us the file type
 * @param {string} params.file_id - The file ID.
 * @param {string} [params.entity_id] - The entity ID, not used here but passed for consistency.
 * @returns {Promise<{ filepath: string, bytes: number }>} - The result object containing the processed `text` and `images` (not currently used),
 *                       along with the `filename` and `bytes` properties.
 */

const uploadTikaOCR = async ({ req, file, file_id, entity_id }) => {
  try {
    const ocrConfig = req.app.locals?.ocr;
    const baseURLConfig = ocrConfig.baseURL || '';
    const isBaseURLEnvVar = !baseURLConfig.trim();

    let baseURL;

    if (isBaseURLEnvVar) {
      const baseURLVarName = 'OCR_BASEURL';
      const authValues = await loadAuthValues({
        userId: req.user.id,
        authFields: [baseURLVarName],
        optional: new Set([baseURLVarName]),
      });

      baseURL = authValues[baseURLVarName];
    } else {
      baseURL = baseURLConfig;
    }

    const extractedText = await uploadDocumentToTika({
      filePath: file.path,
      baseURL,
    });

    // Validate extractedText is a string
    if (typeof extractedText !== 'string') {
      throw new Error('Extracted text is not a string');
    }

    return {
      filename: file.originalname,
      bytes: extractedText.length * 4,
      filepath: 'tika_ocr',
      text: extractedText,
      images: [], // Tika does not return images
    };
  } catch (error) {
    const message = 'Error uploading document to Tika OCR API';
    throw new Error(logAxiosError({ error, message }));
  }
};
module.exports = {
  uploadDocumentToTika,
  uploadTikaOCR,
};