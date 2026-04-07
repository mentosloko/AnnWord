import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameSettings, GameState, CharStatus, UserProfile, WordLength, EnrichedWord, ViewState, DictionarySource, DifficultyLevel, PetState, UserStats } from './types';
import { MAX_GUESSES } from './constants';
import { COMMON_WORDS_EN, ALL_WORDS_EN } from './dictionaries/english';
import { Grid } from './components/Grid';
import { Keyboard } from './components/Keyboard';