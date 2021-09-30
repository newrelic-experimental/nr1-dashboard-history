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

  renderSection = (sectionName, section) => {
    console.info('section', sectionName, section)
    const { onSelectItem } = this.props
    return (
      <div className="search-result__section">
        <div className="search-result__section-header">{sectionName}</div>

        {section.map(items => (
          <div
            className="search-result__section-item"
            onClick={() => onSelectItem()}
          >
            {items.displayValue}
          </div>
        ))}
      </div>
    )
  }

  render() {
    const { results } = this.props
    console.info('results', results)
    return (
      <div className="search-autocomplete__drawer" ref={this.myRef}>
        {Object.keys(results).map(key => this.renderSection(key, results[key]))}
      </div>
    )
  }
}

SearchResults.propTypes = {
  results: PropTypes.object.isRequired,
  closeOnClickOutside: PropTypes.func.isRequired,
}
