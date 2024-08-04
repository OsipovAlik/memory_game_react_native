import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Animated, Easing, Pressable, SafeAreaView,StatusBar, Image, ImageBackground } from 'react-native';
import { Audio } from 'expo-av';
import * as SQLite from 'expo-sqlite';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome6 } from '@expo/vector-icons';
import { AntDesign } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import 'expo-dev-client'



const themes = {
  classic: {
    backgroundColor: 'transparent',
    cardColor: '#fff',
    textColor: '#424242',
  },
  dark: {
    backgroundColor: '#222',
    cardColor: '#424242',
    textColor: 'white',
    cardTextColor:'#424242'
  },
};

const db = SQLite.openDatabaseSync('memory_game_db.db');

const MemoryGame = () => {
  const [fontsLoaded] = useFonts({
    CustomFontRegular: require('./assets/fonts/mighty-souly-font/MightySouly-lxggD.ttf'),
  });

  const MIN_LEVEL = 2;
  const MAX_LEVEL = 25;
  
  const [level, setLevel] = useState(null);
  const [highestLevelUnlocked, setHighestLevelUnlocked] = useState(MIN_LEVEL);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [solved, setSolved] = useState([]);
  const [showWinModal, setShowWinModal] = useState(false);
  const [theme, setTheme] = useState('classic');
  const [animating, setAnimating] = useState(false);
  const [timer, setTimer] = useState(0);
  const [background, setBackground] = useState('#f0f0f0');
  const [gameStarted, setGameStarted] = useState(false);
  const [sound, setSound] = useState();
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [mistakes, setMistakes] = useState(0);
  const [showLoseModal, setShowLoseModal] = useState(false);
 
  
  const MAX_MISTAKES = level * 2;
  
  const rotateValue = useRef(new Animated.Value(0)).current;

  const cardStyles = (isFlipped) => ({
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    elevation: isFlipped ? 0 : 4, // Set elevation to 0 when flipped
    shadowColor: isFlipped ? 'transparent' : '#000', // Set shadowColor to transparent when flipped
    shadowOffset: isFlipped ? { width: 0, height: 0 } : { width: 0, height: 2 },
    shadowOpacity: isFlipped ? 0 : 0.25,
    shadowRadius: isFlipped ? 0 : 3.84,
  });

  
  const generateCards = useCallback((level) => {
    const numbers = Array.from({ length: level }, (_, index) => String.fromCharCode(65 + index)); // A to Z
    const initialCards = numbers.concat(numbers);
    setHeart(initialCards.length)
    return initialCards.sort(() => Math.random() - 0.5);
  }, []);

  const playSound = async (soundFile) => {
    const { sound } = await Audio.Sound.createAsync(soundFile);
    setSound(sound);
    await sound.playAsync();
  };

  const handleCardClick = (index) => {
    if (flipped.length === 2 || solved.includes(cards[index]) || animating || !gameStarted) return;
  
    setFlipped((prevFlipped) => [...prevFlipped, index]);
    playSound(require('./assets/press.mp3'));
  
    if (flipped.length === 1 && cards[flipped[0]] !== cards[index]) {
      setHeart(heart - 1)
      setMistakes((prevMistakes) => prevMistakes + 1);
    }
  };
  useEffect(() => {
    if (level !== null && mistakes >= MAX_MISTAKES) {
      setShowLoseModal(true);
      playSound(require('./assets/lose.wav'));
    }
  }, [mistakes]);
  

  const resetGame = (newLevel) => {
    setLevel(newLevel !== undefined ? newLevel : MIN_LEVEL);
    setCards(generateCards(newLevel !== undefined ? newLevel : MIN_LEVEL));
    setFlipped([]);
    setSolved([]);
    setShowWinModal(false)
    setTimer(0);  
    setMistakes(0); 
    setBackground(`#${Math.floor(Math.random() * 16777215).toString(16)}`);
  };

  useEffect(() => {
    db.withTransactionAsync((tx)=> {
      tx.executeSql(
        'CREATE TABLE IF NOT EXISTS levels (id INTEGER PRIMARY KEY AUTOINCREMENT, level INTEGER);',
        [],
        () => console.log('Levels table created successfully'),
        (_, error) => console.error('Error creating levels table:', error)
      );
    });
   

    db.withTransactionAsync((tx) => {
      tx.executeSql(
        'SELECT MAX(level) AS highestLevel FROM levels;',
        [],
        (_, { rows }) => {
          const highestLevel = rows._array[0]?.highestLevel || MIN_LEVEL;
          setHighestLevelUnlocked(highestLevel);
        },
        (_, error) => console.error('Error fetching unlocked levels:', error)
      );
    });
  }, []);

  useEffect(() => {
    if (gameStarted && level !== null) {
      setCards(generateCards(level));
    }
  }, [gameStarted, level, generateCards]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prevTimer) => prevTimer + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted]);

  useEffect(() => {
    if (flipped.length === 2 && !animating) {
      const [first, second] = flipped;
      if (cards[first] === cards[second]) {
        setSolved((prevSolved) => [...prevSolved, cards[first]]);
      }
      setAnimating(true);
      Animated.sequence([
        Animated.timing(rotateValue, {
          toValue: 1,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(rotateValue, {
          toValue: 0,
          duration: 300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setFlipped([]);
        setAnimating(false);
      });
    }
  }, [flipped, animating, cards, rotateValue]);

  useEffect(() => {
    if (solved.length === level) {
      if (level === highestLevelUnlocked) {
        setHighestLevelUnlocked((prevHighestLevel) => prevHighestLevel + 1);
        db.withTransactionAsync((tx) => {
          tx.executeSql(
            'INSERT INTO levels (level) VALUES (?);',
            [level + 1],
            () => console.log('Unlocked levels updated in the database'),
            (_, error) => console.error('Error updating unlocked levels:', error)
          );
        });
      }
      setShowWinModal(true);
      playSound(require('./assets/win.wav'));
    }
  }, [solved, level, highestLevelUnlocked]);

  const rotateCard = rotateValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const currentTheme = themes[theme];
  const cardSize = level > 10 ? 50 : 70; 

  const resetFlippedAndSolved = () => {
    setFlipped([]);
    setSolved([]);
  }

  const [heart,setHeart] = useState(cards.length)

  if (!fontsLoaded) {
    return null; 
  }

  return (
      <ImageBackground source={require("./images/bg.png")} style={styles.bgGif}>
        <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.backgroundColor }]}>
          <StatusBar barStyle="light-content" backgroundColor={currentTheme.backgroundColor} />
        <View style={[styles.containers, { backgroundColor: currentTheme.backgroundColor }]}>

      {!gameStarted ? (
          <View style={[styles.startPage, { backgroundColor: currentTheme.backgroundColor }]}>
            <Text style={[styles.startText, { color: '#f52c56' }]}>MEMORY GAME </Text>

            <Pressable
              style={[styles.button, { borderColor: 'white' }]}
              onPress={() => {
                setGameStarted(true);
                playSound(require('./assets/touch.wav'));
              }}
            >
             <AntDesign name="caretright" size={80} color="white" />

            </Pressable>
            <Ionicons
              name="settings-outline"
              size={30}
              color={'#f52c56'}
              style={styles.settingsIcon}
              onPress={() => setShowSettingsModal(true)}
            />
          </View>
      ) : (
        <>
          {level === null ? (
            <>
              <Ionicons
                name="arrow-back-outline"
                size={33}
                color={currentTheme.textColor}
                style={styles.returnButtons}
                onPress={() => setGameStarted(false)}
              />
              <View style={styles.levelSelection}>
                {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.levelButton,
                      i + MIN_LEVEL > highestLevelUnlocked && styles.disabledLevelButton,
                    ]}
                    onPress={() => {
                      setLevel(MIN_LEVEL + i);
                      playSound(require('./assets/press.mp3'));
                      resetFlippedAndSolved();
                    }}
                    disabled={i + MIN_LEVEL > highestLevelUnlocked}
                  >
                    {i + MIN_LEVEL > highestLevelUnlocked 
                    ? (
                        <MaterialCommunityIcons
                          name="lock"
                          size={28}
                          color={'#f52c56'}
                          style={styles.lockedIcon}
                        />
                      )
                    :
                      <Text style={[styles.levelButtonText, { color: '#4793AF', fontFamily: 'CustomFontRegular', }]}>
                        {MIN_LEVEL + i - 1}
                      </Text>
                  }
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.returnButton}>
                <TouchableOpacity onPress={() => setLevel(null)} style={styles.returnB}>
                    <Ionicons
                        name="arrow-back-outline"
                        size={33}
                        color={currentTheme.textColor}
                        style={styles.returnIcon}
                    />
                </TouchableOpacity>

                <View style={styles.mistakesContainer}>
                  <View style={styles.mistakecont}>
                      <Text style={styles.heart}>{heart}</Text>
                      <FontAwesome6 name="heart-circle-bolt" size={28} color="#f52c56" />
                  </View>
                </View>
              </View>
              <View style={styles.levelContent}>
                <View style={styles.levelText}>
                  <View style={styles.lvl}>
                    <Text style={[styles.level, { color: '#f52c56' }]}>LEVEL</Text>
                    <Text style={[styles.levelCount, { color:'#f52c56' }]}>{level - 1}</Text>
                  </View>
                </View>
                <View style={styles.cardContainer}>
                  {cards.map((card, index) => (
                    <Animated.View
                    key={index}
                    style={[
                      styles.card,
                      cardStyles(flipped.includes(index) || solved.includes(card)), // Apply dynamic style based on flip state
                      {
                        backgroundColor: currentTheme.cardColor,
                        transform: [{ rotateY: flipped.includes(index) || solved.includes(card) ? rotateCard : '0deg' }],
                        width: cardSize,
                        height: cardSize,
                      },
                    ]}
                    >
                      <TouchableOpacity
                        style={styles.cardInner}
                        onPress={() => handleCardClick(index)}
                        disabled={flipped.includes(index) || solved.includes(card) || animating || !gameStarted}
                      >
                        <Text style={[styles.cardText, { color: '#f52c56',fontFamily: 'CustomFontRegular', }]}>
                          {flipped.includes(index) || solved.includes(card) ? card : ''}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              </View>
            </>
          )}
          <Modal animationType="slide" transparent={true} visible={showWinModal} onRequestClose={() => setShowWinModal(false)}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
              <View style={[styles.modalContainer, { backgroundColor: currentTheme.cardColor }]}>
                <Text style={[styles.modalHeader, { color: "#18A33F" }]}>
                  WIN !
                </Text>
                <TouchableOpacity 
                  onPress={()=>{
                    resetGame(level + 1)
                  }}
                  style={styles.winNext}
                >
                  <Text color={currentTheme.textColor} style={styles.nextLevel}>Next Level</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )
    }
      {/* Settings Modal */}
      {showSettingsModal && (
          <Modal
            animationType="slide"
            transparent={true}
            visible={showSettingsModal}
            onRequestClose={() => setShowSettingsModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContainer, { backgroundColor: currentTheme.cardColor }]}>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowSettingsModal(false)}>
              <AntDesign name="close" size={25} color="black" />

                </TouchableOpacity>
                <View style={styles.themeContainer}>
                  {Object.keys(themes).map((themeName) => (
                    <TouchableOpacity
                      key={themeName}
                      style={[styles.themeButton, { backgroundColor: themes[themeName].cardColor }]}
                      onPress={() => {
                        setTheme(themeName);
                        setShowSettingsModal(false);
                      }}
                    >
                      <Text style={[styles.themeButtonText, { color: themes[themeName].textColor }]}>
                        {themeName.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                
              </View>
            </View>
          </Modal>
        )}
      <Modal animationType="slide" transparent={true} visible={showLoseModal} onRequestClose={() => setShowLoseModal(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
          <View style={[styles.modalContainer, { backgroundColor: currentTheme.cardColor }]}>
            <Text style={[styles.modalHeader, { color: '#f52c56' }]}>
              You Lose!
            </Text>
            <View style={styles.loseModalTexts}>
              <TouchableOpacity
                onPress={()=>{
                  setShowLoseModal(false);
                  resetGame(level); 
                }}
                style={styles.restartButton}
              >
                <Text style={styles.restartButtonText}>RESTART</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={()=>{
                  setShowLoseModal(false);
                    setGameStarted(false);
                    resetGame(level);
                    setLevel(null)
                }}
                style={styles.returnMainMenu}
              >
                <Text color={currentTheme.textColor} style={styles.returnButtonText}>Main Menu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
    </SafeAreaView>
    </ImageBackground>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding:0,
    margin:0,

    fontFamily: 'CustomFontRegular',
  },
  containers: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop:0,
    padding:0,
    margin:0,
  },
  nextLevel:{
    fontSize:20,
    fontFamily: 'CustomFontRegular',
    color:"#fff" 
  },
  winNext:{
    paddingHorizontal:20,
    height:40,
    alignItems:'center',
    justifyContent:'center',
    borderRadius:6,
    backgroundColor:'#18A33F'
  },
  bgGif: {
    width: '100%',
    height: '100%',
    zIndex: 9,
    left:0,
    margin:0,
    padding:0,
    top:0,
  },
  selectLevelText: {
      fontSize:23,
      fontWeight:'bold'
  },
  startPage: {
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  returnMainMenu:{
    justifyContent:'center',
    alignItems:'center',
    height:40,
    paddingHorizontal:10,
    borderRadius:6,
    borderWidth:2,
    borderColor:'#f52c56',
  },
  startText: {
    fontSize: 90,
    marginBottom: 300,
    fontWeight: '600',
    textAlign:'center',
    fontFamily: 'CustomFontRegular',
  },
  returnHomePage: {
    position: 'absolute',
    top: 70,
  },
  mistakesContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  mistakecont:{
    height:35,
    borderRadius:30,
    width:80,
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    paddingHorizontal:9,
    backgroundColor:'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 1.84,
  
  },
  
  restartButton:{
    marginBottom:20,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
    height: 40,
    borderRadius:6,
    backgroundColor:'#f52c56',
  },
  restartButtonText:{
    fontSize:20,
    fontFamily: 'CustomFontRegular',
    color:'#fff'
  },
  mistakesText: {
    fontSize: 20,
    fontWeight: 'bold',
    justifyContent:'flex-end',
  },
  heart:{
    fontSize: 19,
    fontWeight:'bold',
    color:'grey'
  },
  button: {
    width: 140,
    height: 140,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor:'#f52c56',
    shadowColor: 'white',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.9,
    shadowRadius: 1,
    elevation:9,
  },
  buttonText: {
    fontSize: 27,
    fontWeight: '700',
  },
  returnIcon: {
    zIndex:9,
    paddingLeft:10,
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'start',
    paddingHorizontal: 10,
  },
  lvl: {
    flexDirection: 'row',
    alignItems: 'center',
    
  },
  levelCount: {
    fontSize: 40,
    fontFamily: 'CustomFontRegular',
  },
  returnB: {
    zIndex:9 
  },
  levelContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  level: {
    fontSize: 40,
    padding: 30,
    textShadowColor: 'white',
    fontFamily: 'CustomFontRegular',
  },
  returnButton: {
    width: '100%',
    zIndex:99,
    flexDirection:'row',
    justifyContent:'space-between',
  },
  returnButtonText:{
    fontSize:20,
    fontFamily: 'CustomFontRegular',
    color:'#f52c56'
  },
  levelText: {
    fontSize: 24,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledLevelButton: {
    color: 'black',
  },
  card: {
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cardInner: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backfaceVisibility: 'hidden',
  },
  cardText: {
    fontSize: 30,
    fontWeight: 600,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  lockedIcon: {
    position: 'absolute',
    top: 'auto',
    right: 'auto',
    zIndex: 1,
  },
  modalContainer: {
    width:'70%',
    padding: 20,  
    borderRadius: 10,
    alignItems: 'center',
  },
  modalHeader: {
    fontSize: 50,
    marginBottom: 20,
    fontWeight: 'bold',
    fontFamily: 'CustomFontRegular',
  },
  levelSelection: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'center',
    alignContent: 'center',
  },
  levelButton: {
    backgroundColor: 'white',
    width: 85,
    height: 85,
    margin: 5,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 4,
  },
  levelButtonText: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  
  returnText: {
    position: 'absolute',
    top: 100,
    fontSize: 29,
    color: 'blue',
    textDecorationLine: 'underline',
  },
  returnButtonsContent: {
    width:'100%',
    justifyContent:'start'
  },
  returnButtons: {
    width:'fit-content',
    position:'absolute',
    top:0,
    left:10,
    zIndex:9
  },
  themeButton: {
    backgroundColor: '#fff',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  themeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    position:'absolute',
    right:0,
    top:0,
    zIndex:9,
    padding:10,

    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'red',
  },
  settingsIcon: {
    position: 'absolute',
    top: 5,
    right: 10,
  },
});

export default MemoryGame;
