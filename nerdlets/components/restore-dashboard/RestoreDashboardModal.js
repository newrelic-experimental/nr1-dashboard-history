import React from 'react'
import PropTypes from 'prop-types'

import {
  Modal,
  HeadingText,
  BlockText,
  Button,
  NerdGraphMutation,
  Icon,
  Toast,
} from 'nr1'
import { openDashboard } from '../../common/utils/navigation'
export default class RestoreDashboardModal extends React.Component {
  state = {
    mutating: false,
    mutationErrors: null,
  }

  handleRestore = () => {
    const { dashboard, onClose } = this.props
    this.setState({ mutating: true, mutationErrors: null }, async () => {
      const mutation = `mutation {
      dashboardUndelete(guid: "${dashboard.dashboardGuid}") {
          errors {
            description
            type
          }
        }
      }`

      const { errors } = await NerdGraphMutation.mutate({
        mutation,
      })
      // just slow down the very fast mutation response; it's a better UX and gives time for the restoration to show up in the data
      setTimeout(() => {
        const cleanUp = () => {
          if (!errors)
            Toast.showToast({
              title: `Restored Dashboard`,
              description: `${dashboard.dashboardName} restored in account ${dashboard.accountName}`,
              actions: [
                {
                  label: 'View',
                  onClick: () => openDashboard(dashboard.dashboardGuid),
                },
              ],
            })
          onClose(null, dashboard)
        }

        this.setState(
          {
            mutating: false,
            mutationErrors: errors,
          },
          cleanUp()
        )
      }, 2000)
    })
  }

  render() {
    const { onClose, onHideEnd, hidden, dashboard } = this.props
    const { mutating, mutationErrors } = this.state

    return (
      <Modal onClose={onClose} onHideEnd={onHideEnd} hidden={hidden}>
        <div className="modal-container">
          {mutationErrors && (
            <div className="modal-errors-container">
              <div className="modal-errors-header-container">
                <div className="modal-errors-header">
                  <Icon
                    color="red"
                    type={Icon.TYPE.INTERFACE__OPERATIONS__CLOSE__V_ALTERNATE}
                    className="modal-errors-icon"
                  />
                  <p>Sorry, we ran into a problem</p>
                </div>
                <BlockText>
                  Please review the errors below. You can click Continue to try
                  again, or Cancel to return to the previous screen.
                </BlockText>
              </div>
              <div className="modal-errors-list">
                {mutationErrors.map(error => (
                  <ul className="modal-error">
                    <li>
                      <div>
                        <strong>{error.type}</strong>
                      </div>
                      <div>{error.description}</div>
                    </li>
                  </ul>
                ))}
              </div>
            </div>
          )}
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
          <div className="button-row">
            <Button onClick={onClose} disabled={mutating}>
              Cancel
            </Button>
            <Button
              onClick={this.handleRestore}
              loading={mutating}
              type={Button.TYPE.PRIMARY}
            >
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    )
  }
}

RestoreDashboardModal.propTypes = {
  hidden: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onHideEnd: PropTypes.func.isRequired,
  dashboard: PropTypes.object.isRequired,
}
