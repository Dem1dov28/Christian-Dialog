import apiClient from "../services/api";

/**
 * Утилиты для работы с файлами
 */

/**
 * Форматирует размер файла в читаемый формат
 * @param {number} bytes - Размер файла в байтах
 * @returns {string} - Отформатированный размер (B, KB, MB)
 */
export const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
};

/**
 * Получает иконку для типа файла на основе расширения
 * @param {string} fileType - MIME тип файла
 * @param {string} fileName - Имя файла
 * @returns {string} - Эмодзи иконка
 */
export const getFileIcon = (fileType, fileName) => {
  const ext = fileName.toLowerCase().split('.').pop();
  if (['pdf'].includes(ext)) return '';
  if (['docx', 'doc', 'odt', 'rtf'].includes(ext)) return '';
  if (['xlsx', 'csv', 'ods'].includes(ext)) return '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'].includes(ext)) return '';
  if (['py', 'js', 'ts', 'java', 'cpp', 'cs', 'html', 'css', 'json', 'xml', 'yaml', 'yml', 'toml', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'dart', 'sh', 'bash', 'zsh'].includes(ext)) return '';
  if (['txt', 'md'].includes(ext)) return '';
  return '';
};

/**
 * Загружает файл с отслеживанием прогресса
 * @param {File} file - Файл для загрузки
 * @param {function} onProgress - Callback для отслеживания прогресса (percentage, fileName)
 * @returns {Promise} - Promise с результатом загрузки
 */
export const uploadFileWithProgress = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // Отслеживание прогресса
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = Math.round((event.loaded / event.total) * 100);
        onProgress(percentage, file.name);
      }
    };

    // Обработка успешной загрузки
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          resolve({});
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.detail || `Upload failed with status ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    // Обработка ошибок
    xhr.onerror = () => {
      reject(new Error('Network error during file upload'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timeout'));
    };

    // Отправка запроса
    xhr.open('POST', `${apiClient.baseURL}/chat/upload-file`);
    const token = apiClient.token;
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // Устанавливаем timeout (60 секунд для больших файлов)
    xhr.timeout = 60000;

    xhr.send(formData);
  });
};



