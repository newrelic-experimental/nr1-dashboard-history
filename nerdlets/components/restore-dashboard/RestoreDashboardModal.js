import React, { Component } from 'react'

import { Modal, HeadingText, BlockText, Button } from 'nr1'
export default class RestoreDashboardModal extends Component {
  render() {
    const { onClose, onHideEnd, hidden, dashboard } = this.props
    return (
      <Modal onClose={onClose} onHideEnd={onHideEnd} hidden={hidden}>
        <div className="modal-container">
          <HeadingText type={HeadingText.TYPE.HEADING_3}>
            Restore Dashboard{' '}
            <strong>
              {dashboard.accountName}/{dashboard.dashboardName}
            </strong>
          </HeadingText>
          <div className="modal-text-container">
            <BlockText className="modal-text">
              This action will restore access to the{' '}
              <strong>{dashboard.dashboardName}</strong> in the{' '}
              <strong>{dashboard.accountName}</strong> account.
            </BlockText>
            <BlockText className="modal-text">
              Are you sure you want to continue?
            </BlockText>
          </div>
          <div className="button-row modal-button-row">
            <Button>Cancel</Button>
            <Button>Continue</Button>
          </div>
        </div>
      </Modal>
    )
  }
}
