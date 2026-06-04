(function (global) {
  'use strict';

  var DEFAULT_QUESTION_ID = 'base-sequence';
  var USER_QUESTION_IDS = [
    'base-sequence',
    'base-breathing-safety',
    'base-mantra-chakra',
    'base-errors-corrections',
    'base-repeats',
    'base-inverses',
    'shared-asanas',
    'cyp-visual-references',
    'sn-variants',
    'same-asana-equivalences'
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function clearElement(element) {
    if (!element) {
      return;
    }
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function createElement(tagName, className, textContent) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (typeof textContent === 'string') {
      element.textContent = textContent;
    }
    return element;
  }

  function compactText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function getQuestionById(state, questionId) {
    return state.questionsById[questionId] || null;
  }

  function getQuestionTag(questionId) {
    if (questionId.indexOf('breathing') !== -1 || questionId.indexOf('mantra') !== -1) {
      return 'Practice Details';
    }
    if (questionId.indexOf('error') !== -1 || questionId.indexOf('correction') !== -1) {
      return 'Guidance';
    }
    if (questionId.indexOf('visual') !== -1) {
      return 'Visuals';
    }
    if (questionId.indexOf('shared') !== -1 || questionId.indexOf('same-') !== -1 || questionId.indexOf('variant') !== -1) {
      return 'Variants';
    }
    return 'Sequence';
  }

  function padIndex(value) {
    var number = Number(value) || 0;
    return number < 10 ? '0' + number : String(number);
  }

  function normalizeLanguage(state, language) {
    if (state.data && typeof state.data.normalizeResultLanguage === 'function') {
      return state.data.normalizeResultLanguage(language);
    }
    return compactText(language).toLowerCase() || 'en';
  }

  function setStatus(state, message) {
    if (state.status) {
      state.status.textContent = message || '';
    }
  }

  function setError(state, message) {
    if (!state.error) {
      return;
    }
    state.error.hidden = !message;
    state.error.textContent = message || '';
  }

  function isVisualCellData(value) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      value.kind === 'cyp-visual' &&
      value.src
    );
  }

  function openLightbox(state, visual) {
    if (!state.lightbox || !state.lightboxImage || !state.lightboxCaption) {
      return;
    }
    state.lightboxImage.src = visual.src;
    state.lightboxImage.alt = visual.alt || visual.asanaLabel || 'Expanded CYP visual';
    state.lightboxCaption.textContent = (visual.asanaLabel || 'CYP visual') + ' - ' + (visual.caption || '');
    state.lightbox.hidden = false;
    state.lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox(state) {
    if (!state.lightbox) {
      return;
    }
    state.lightbox.hidden = true;
    state.lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function renderFacts(state, facts) {
    clearElement(state.facts);
    (facts || []).forEach(function (fact) {
      var card = createElement('div', 'education-fact-card');
      card.appendChild(createElement('span', '', fact.label));
      card.appendChild(createElement('strong', '', fact.value));
      state.facts.appendChild(card);
    });
  }

  function renderVisualTableCell(state, visualData) {
    var cell = createElement('td', 'education-table-cell education-table-cell--visual');
    var button = createElement('button', 'education-table-visual-button');
    var image = createElement('img', 'education-table-visual-image');
    var label = createElement('span', 'education-table-visual-label', 'Expand image');

    button.type = 'button';
    button.setAttribute('aria-label', 'Expand ' + (visualData.asanaLabel || 'asana') + ' visual reference');
    image.src = visualData.src;
    image.alt = visualData.alt || ((visualData.asanaLabel || 'Asana') + ' visual reference');
    image.loading = 'lazy';

    button.appendChild(image);
    button.appendChild(label);
    button.addEventListener('click', function () {
      openLightbox(state, visualData);
    });
    cell.appendChild(button);
    return cell;
  }

  function renderTableCell(state, value) {
    var cell;
    if (isVisualCellData(value)) {
      return renderVisualTableCell(state, value);
    }
    cell = createElement('td');
    cell.textContent = value === null || value === undefined || value === '' ? '-' : String(value);
    return cell;
  }

  function renderTable(state, table) {
    var wrapper;
    var tableElement;
    var thead;
    var headerRow;
    var tbody;

    if (!table || !table.columns || !table.rows) {
      return;
    }

    wrapper = createElement('div', 'education-detail-card education-table-wrap');
    tableElement = createElement('table');
    thead = createElement('thead');
    headerRow = createElement('tr');
    tbody = createElement('tbody');

    table.columns.forEach(function (column) {
      headerRow.appendChild(createElement('th', '', column));
    });

    table.rows.forEach(function (row) {
      var bodyRow = createElement('tr');
      row.forEach(function (cellValue) {
        bodyRow.appendChild(renderTableCell(state, cellValue));
      });
      tbody.appendChild(bodyRow);
    });

    thead.appendChild(headerRow);
    tableElement.appendChild(thead);
    tableElement.appendChild(tbody);
    wrapper.appendChild(tableElement);
    state.sections.appendChild(wrapper);
  }

  function renderSections(state, answer) {
    clearElement(state.sections);
    if (answer && answer.table) {
      renderTable(state, answer.table);
    }
    (answer && answer.sections ? answer.sections : []).forEach(function (section) {
      var card = createElement('div', 'education-detail-card');
      var title = createElement('h3', '', section.title || 'Details');
      var list = createElement('ul');
      (section.items || []).forEach(function (item) {
        list.appendChild(createElement('li', '', item));
      });
      card.appendChild(title);
      card.appendChild(list);
      state.sections.appendChild(card);
    });
    state.sections.hidden = !state.sections.children.length;
  }

  function renderVisuals(state, visuals) {
    clearElement(state.visuals);
    if (!visuals || !visuals.length) {
      state.visuals.appendChild(
        createElement('div', 'education-visual-empty', 'No linked CYP page is available for this answer.')
      );
      if (state.visualNote) {
        state.visualNote.textContent = 'No linked CYP page is currently available for this answer in the ontology.';
      }
      return;
    }

    if (state.visualNote) {
      state.visualNote.textContent = 'Showing ' + visuals.length + ' linked CYP page visual' +
        (visuals.length === 1 ? '' : 's') + ' for this answer.';
    }

    visuals.forEach(function (visual) {
      var card = createElement('article', 'education-visual-card');
      var button = createElement('button', 'education-visual-button');
      var image = createElement('img', 'visual-reference-thumbnail');
      var meta = createElement('div', 'education-visual-meta');

      button.type = 'button';
      image.src = visual.src;
      image.alt = visual.alt || visual.asanaLabel || 'CYP visual reference';
      image.loading = 'lazy';
      button.appendChild(image);
      button.addEventListener('click', function () {
        openLightbox(state, visual);
      });

      meta.appendChild(createElement('strong', '', visual.asanaLabel || 'CYP visual'));
      meta.appendChild(createElement('p', '', visual.caption || 'CYP page ' + visual.page));
      meta.appendChild(createElement('span', '', visual.page ? 'Page ' + visual.page : 'CYP page'));

      card.appendChild(button);
      card.appendChild(meta);
      state.visuals.appendChild(card);
    });
  }

  function updateQuestionButtons(state) {
    Array.prototype.forEach.call(state.questionList.querySelectorAll('[data-question-id]'), function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-question-id') === state.selectedQuestionId ? 'true' : 'false');
    });
  }

  function renderQuestion(state, questionId) {
    var question = getQuestionById(state, questionId);
    var answer;
    var visibleIndex;

    if (!question || !state.model) {
      return;
    }

    try {
      answer = question.run(state.model, {
        language: state.selectedLanguage
      });
      state.selectedQuestionId = question.id;
      visibleIndex = state.questions.indexOf(question);

      if (state.answerTitle) {
        state.answerTitle.textContent = question.prompt;
      }
      if (state.answerText) {
        state.answerText.textContent = answer.narrative || '';
      }
      if (state.activeQuestionId) {
        state.activeQuestionId.textContent = 'Q-' + padIndex(visibleIndex + 1);
      }

      renderFacts(state, answer.facts || []);
      renderSections(state, answer);
      renderVisuals(state, answer.visuals || []);
      updateQuestionButtons(state);
      setError(state, '');

      if (global.history && typeof global.history.replaceState === 'function') {
        global.history.replaceState(null, '', '#' + question.id);
      }
    } catch (error) {
      setError(state, error && error.message ? error.message : 'Unable to render this answer.');
    }
  }

  function renderQuestionList(state) {
    clearElement(state.questionList);
    state.questions.forEach(function (question, index) {
      var button = createElement('button', 'education-question-button');
      var eyebrow = createElement('div', 'education-question-eyebrow');

      button.type = 'button';
      button.setAttribute('data-question-id', question.id);
      button.setAttribute('aria-pressed', question.id === state.selectedQuestionId ? 'true' : 'false');
      button.title = question.prompt;

      eyebrow.appendChild(createElement('span', '', 'Q-' + padIndex(index + 1)));
      eyebrow.appendChild(createElement('span', '', getQuestionTag(question.id)));
      button.appendChild(eyebrow);
      button.appendChild(createElement('strong', 'education-question-title', question.title));
      button.appendChild(createElement('p', 'education-question-prompt', question.prompt));
      button.addEventListener('click', function () {
        renderQuestion(state, question.id);
      });

      state.questionList.appendChild(button);
    });
  }

  function getInitialQuestionId(state) {
    var requestedId = compactText(global.location.hash).replace(/^#/, '');
    if (requestedId && getQuestionById(state, requestedId)) {
      return requestedId;
    }
    return getQuestionById(state, DEFAULT_QUESTION_ID) ? DEFAULT_QUESTION_ID : (state.questions[0] && state.questions[0].id);
  }

  function updateStats(state) {
    if (state.statVariants) {
      state.statVariants.textContent = String(state.model.variants.length);
    }
    if (state.statPoses) {
      state.statPoses.textContent = String(state.model.poses.length);
    }
    if (state.statAsanas) {
      state.statAsanas.textContent = String(state.model.asanas.length);
    }
  }

  function initializeLightbox(state) {
    if (state.lightboxClose) {
      state.lightboxClose.addEventListener('click', function () {
        closeLightbox(state);
      });
    }
    if (state.lightbox) {
      state.lightbox.addEventListener('click', function (event) {
        if (event.target === state.lightbox) {
          closeLightbox(state);
        }
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && state.lightbox && !state.lightbox.hidden) {
        closeLightbox(state);
      }
    });
  }

  function mount() {
    var root = document.querySelector('[data-sn-user-app]');
    var graph = global.SNOntologyGraph;
    var data = global.SNEducationData;
    var questions;
    var state;

    if (!root || !graph || !data) {
      return null;
    }

    questions = USER_QUESTION_IDS.map(function (questionId) {
      return data.QUESTIONS.find(function (question) {
        return question.id === questionId;
      });
    }).filter(Boolean);

    state = {
      root: root,
      graph: graph,
      data: data,
      questions: questions,
      questionsById: questions.reduce(function (accumulator, question) {
        accumulator[question.id] = question;
        return accumulator;
      }, {}),
      selectedQuestionId: '',
      selectedLanguage: data.DEFAULT_LANGUAGE || 'en',
      model: null,
      languageSelect: byId('sn-user-language-select'),
      status: byId('sn-user-status'),
      questionList: byId('sn-user-question-list'),
      answerTitle: byId('sn-user-answer-title'),
      answerText: byId('sn-user-answer-text'),
      activeQuestionId: byId('sn-user-active-question-id'),
      facts: byId('sn-user-facts'),
      sections: byId('sn-user-sections'),
      visuals: byId('sn-user-visuals'),
      visualNote: byId('sn-user-visual-note'),
      error: byId('sn-user-error'),
      statVariants: byId('sn-user-stat-variants'),
      statPoses: byId('sn-user-stat-poses'),
      statAsanas: byId('sn-user-stat-asanas'),
      lightbox: byId('sn-user-lightbox'),
      lightboxClose: byId('sn-user-lightbox-close'),
      lightboxImage: byId('sn-user-lightbox-image'),
      lightboxCaption: byId('sn-user-lightbox-caption')
    };

    state.selectedQuestionId = getInitialQuestionId(state);
    initializeLightbox(state);
    renderQuestionList(state);
    setStatus(state, 'Loading ontology...');
    setError(state, '');
    renderVisuals(state, []);

    if (state.languageSelect) {
      state.languageSelect.value = state.selectedLanguage;
      state.languageSelect.addEventListener('change', function () {
        state.selectedLanguage = normalizeLanguage(state, state.languageSelect.value);
        renderQuestion(state, state.selectedQuestionId);
      });
    }

    graph.load({
      ontologySrc: root.dataset.ontologySrc,
      cypImageBase: root.dataset.cypImageBase
    }).then(function (model) {
      state.model = model;
      updateStats(state);
      setStatus(state, 'Ontology ready');
      renderQuestion(state, state.selectedQuestionId);
    }).catch(function (error) {
      setStatus(state, 'Ontology failed');
      setError(state, error && error.message ? error.message : 'Unable to load the ontology.');
    });

    return state;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
}(window));
