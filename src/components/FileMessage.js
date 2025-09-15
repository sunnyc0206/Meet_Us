import React, { useState } from 'react';

// Helper to get an icon based on a single status string
const getStatusIcon = (status) => {
    switch (status) {
        case 'completed': return <i className="fas fa-check-circle status-icon-success"></i>;
        case 'rejected':
        case 'failed': return <i className="fas fa-times-circle status-icon-danger"></i>;
        case 'sending': return <i className="fas fa-spinner fa-spin status-icon-progress"></i>;
        case 'pending':
        default: return <i className="fas fa-clock status-icon-pending"></i>;
    }
};

// Helper to determine the overall status icon for a multi-recipient transfer
const getOverallStatusIcon = (statusMap) => {
    const statuses = Object.values(statusMap);

    if (statuses.some(s => s === 'sending')) {
        return <i className="fas fa-spinner fa-spin status-icon-progress"></i>;
    }
    if (statuses.some(s => s === 'pending')) {
        return <i className="fas fa-clock status-icon-pending"></i>;
    }
    if (statuses.every(s => s === 'completed' || s === 'rejected' || s === 'failed')) {
        // If at least one was successful, show success, otherwise show failure
        return statuses.some(s => s === 'completed') 
            ? <i className="fas fa-check-circle status-icon-success"></i>
            : <i className="fas fa-times-circle status-icon-danger"></i>;
    }
    // Default fallback
    return <i className="fas fa-clock status-icon-pending"></i>;
};


const FileMessage = ({ msg, acceptFile, rejectFile, formatFileSize }) => {
    // State to manage the visibility of the detailed status list
    const [isExpanded, setIsExpanded] = useState(false);

    // RENDER: Incoming file request (for recipient)
    if (msg.type === 'file-request') {
        return (
            <div className="file-message info">
                <div className="file-icon"><i className="fas fa-file-alt"></i></div>
                <div className="file-details">
                    <strong>{msg.fromUsername} wants to send a file:</strong>
                    <span>{msg.fileName} ({formatFileSize(msg.fileSize)})</span>
                </div>
                <div className="file-actions">
                    <button onClick={() => acceptFile(msg)} className="btn-success" title="Accept">
                        <i className="fas fa-check"></i>
                    </button>
                    <button onClick={() => rejectFile(msg)} className="btn-danger" title="Reject">
                        <i className="fas fa-times"></i>
                    </button>
                </div>
            </div>
        );
    }

    // RENDER: File transfer status
    if (msg.type === 'file-transfer') {
        // RENDER: Sender's multi-recipient view with collapsible details
        if (msg.isOwn && msg.recipients) {
            return (
                <div className={`file-message multi-recipient ${msg.status}`}>
                    <div className="file-details">
                        <strong>{msg.fileName}</strong>
                        <span>{formatFileSize(msg.fileSize)} &bull; Sent to {msg.recipients.length} users</span>
                    </div>

                    {/* NEW: Collapsible Status Section */}
                    <div className="status-toggle-section">
                        <div className="status-summary" onClick={() => setIsExpanded(!isExpanded)}>
                            <span className="summary-icon">{getOverallStatusIcon(msg.statusMap)}</span>
                            {/* <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i> */}
                        </div>

                        {/* {isExpanded && (
                            <ul className="recipient-status-list">
                                {msg.recipients.map(recipient => {
                                    const status = msg.statusMap[recipient.id];
                                    const sentSize = msg.sentSizeMap?.[recipient.id] || 0;
                                    const progress = msg.fileSize > 0 ? (sentSize / msg.fileSize) * 100 : 0;
                                    return (
                                        <li key={recipient.id}>
                                            <span className="recipient-name">{recipient.username}</span>
                                            <span className="recipient-status">
                                                {getStatusIcon(status)} {status} {status === 'sending' && `${Math.round(progress)}%`}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        )} */}
                    </div>
                </div>
            );
        }

        // RENDER: Recipient's view or old single-transfer view
        const progress = msg.fileSize > 0 ? (msg.receivedSize / msg.fileSize) * 100 : 0;
        const statusText = msg.status === 'receiving' ? `Receiving... ${Math.round(progress)}%` : 
                           msg.status.charAt(0).toUpperCase() + msg.status.slice(1);

        return (
            <div className={`file-message single-recipient ${msg.status}`}>
                <div className="file-icon">
                    {getStatusIcon(msg.status)}
                </div>
                <div className="file-details">
                    <strong>{msg.fileName}</strong>
                    <span>{formatFileSize(msg.fileSize)}</span>
                    <div className="status-text">{statusText}</div>
                    {msg.status === 'receiving' && <progress value={progress} max="100"></progress>}
                </div>
            </div>
        );
    }

    return null;
};

export default FileMessage;