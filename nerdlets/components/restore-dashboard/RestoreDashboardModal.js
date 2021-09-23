import React, { Component } from 'react'

import { Modal, HeadingText, BlockText, Button, Spinner } from 'nr1'
export default class RestoreDashboardModal extends Component {
  render() {
    const { onClose, onHideEnd, hidden, dashboard } = this.props
    return (
      <Modal onClose={onClose} onHideEnd={onHideEnd} hidden={hidden}>
        {JSON.stringify(dashboard)}
      </Modal>
    )
  }
}
