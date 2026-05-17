// 本地存儲評論管理
const COMMENTS_STORAGE_KEY = 'gallery_comments';
const UPLOADS_STORAGE_KEY = 'gallery_uploads';

export class GalleryManager {
  static getComments() {
    const stored = localStorage.getItem(COMMENTS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static addComment(comment) {
    const comments = this.getComments();
    const newComment = {
      id: Date.now(),
      ...comment,
      timestamp: new Date().toISOString(),
      approved: false
    };
    comments.unshift(newComment);
    localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(comments));
    return newComment;
  }

  static getUploads() {
    const stored = localStorage.getItem(UPLOADS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static addUpload(upload) {
    const uploads = this.getUploads();
    const newUpload = {
      id: Date.now(),
      ...upload,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    uploads.unshift(newUpload);
    localStorage.setItem(UPLOADS_STORAGE_KEY, JSON.stringify(uploads));
    return newUpload;
  }

  static renderComments(container) {
    const comments = this.getComments();
    
    if (comments.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-500 py-8">暫無評論，快來分享您的想法！</p>';
      return;
    }

    const commentsHTML = comments
      .filter(c => c.approved)
      .map(comment => `
        <div class="bg-gray-50 rounded-lg p-6 mb-4">
          <div class="flex justify-between items-start mb-2">
            <div>
              <h4 class="font-semibold text-gray-900">${this.escapeHtml(comment.commenter_name)}</h4>
              <p class="text-sm text-gray-500">${new Date(comment.timestamp).toLocaleDateString('zh-TW')}</p>
            </div>
            <div class="text-yellow-400">${'⭐'.repeat(comment.rating || 5)}</div>
          </div>
          <p class="text-gray-700">${this.escapeHtml(comment.comment_text)}</p>
        </div>
      `)
      .join('');

    container.innerHTML = commentsHTML;
  }

  static renderUploads(container) {
    const uploads = this.getUploads();
    
    if (uploads.length === 0) {
      return;
    }

    const uploadsHTML = uploads
      .filter(u => u.status === 'approved')
      .map(upload => `
        <div class="text-center">
          <p class="text-sm text-gray-600 mb-1">上傳者: ${this.escapeHtml(upload.artist_name)}</p>
          <p class="text-sm font-semibold text-gray-900">${this.escapeHtml(upload.work_title)}</p>
          ${upload.work_description ? `<p class="text-xs text-gray-500 mt-1">${this.escapeHtml(upload.work_description)}</p>` : ''}
        </div>
      `)
      .join('');

    if (uploadsHTML) {
      container.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">${uploadsHTML}</div>`;
    }
  }

  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static setupFormHandlers() {
    // 評論表單
    const commentForm = document.querySelector('form[name="gallery-comment"]');
    if (commentForm) {
      commentForm.addEventListener('submit', (e) => {
        const input = new FormData(commentForm);
        const comment = {
          commenter_name: input.get('commenter_name'),
          commenter_email: input.get('commenter_email'),
          rating: input.get('rating'),
          comment_text: input.get('comment_text')
        };
        
        // 提交到 Netlify 和本地存儲
        this.addComment(comment);
        
        // 清空表單
        commentForm.reset();
        
        // 顯示成功訊息
        this.showNotification('感謝您的評論！');
      });
    }

    // 上傳表單
    const uploadForm = document.querySelector('form[name="gallery-upload"]');
    if (uploadForm) {
      uploadForm.addEventListener('change', (e) => {
        if (e.target.name === 'work_image') {
          this.previewImage(e.target);
        }
      });
    }
  }

  static previewImage(input) {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.querySelector('.image-preview');
        if (preview) {
          preview.innerHTML = `<img src="${e.target.result}" alt="預覽" class="max-w-xs rounded-lg">`;
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  static showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  const manager = new GalleryManager();
  manager.setupFormHandlers();
  
  // 渲染評論
  const commentsContainer = document.querySelector('.comments-display');
  if (commentsContainer) {
    manager.renderComments(commentsContainer);
  }
});
