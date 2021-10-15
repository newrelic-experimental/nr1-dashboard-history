import React from 'react'
import PropTypes from 'prop-types'

export default class SearchResults extends React.Component {
  myRef = React.createRef()

  onClickOutside = e => {
    const { closeOnClickOutside } = this.props
    if (!this.myRef.current.contains(e.target)) closeOnClickOutside()
  }

  componentDidMount() {
    document.addEventListener('mousedown', this.onClickOutside)
  }

  componentWillUnmount() {
    document.removeEventListener('mousedown', this.onClickOutside)
  }

  render() {
    const { results, onSelectItem } = this.props
    return (
      <div className="search-autocomplete__drawer" ref={this.myRef}>
        {Object.entries(results).map(entry => (
          <div
            className="search-result__item"
            onClick={() => onSelectItem(entry[0], entry[1])}
          >
            {entry[0]}
          </div>
        ))}
      </div>
    )
  }
}

SearchResults.propTypes = {
  results: PropTypes.object.isRequired,
  closeOnClickOutside: PropTypes.func.isRequired,
  onSelectItem: PropTypes.func.isRequired,
}
