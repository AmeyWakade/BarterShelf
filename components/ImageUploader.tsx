import React from 'react';import { Alert,Image,Pressable,ScrollView,Text,View } from 'react-native';import * as ImagePicker from 'expo-image-picker';import { colors } from './ui';
export function ImageUploader({images,onChange,max=4}:{images:string[];onChange:(images:string[])=>void;max?:number}){
 async function add(source:'camera'|'gallery'){
  if(images.length>=max)return Alert.alert('Photo limit',`Choose up to ${max} photos per listing.`);
  try{
   let result:ImagePicker.ImagePickerResult;
   if(source==='camera'){
    const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)return Alert.alert('Camera access needed','Allow camera access to take a listing photo.');
    result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.78});
   }else{
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return Alert.alert('Photo library access needed','Allow photo library access to choose listing photos.');
    result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:max-images.length,quality:.78});
   }
   if(!result.canceled)onChange([...images,...result.assets.map(asset=>asset.uri)].slice(0,max));
  }catch(error){Alert.alert('Could not add photo',error instanceof Error?error.message:'Try again.')}
 }
 return <View style={{gap:10,marginBottom:22}}><Text style={{fontSize:13,fontWeight:'700',color:colors.ink}}>Photos · up to {max}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9}}>{images.map((uri,index)=><View key={`${uri}-${index}`} style={{position:'relative'}}><Image source={{uri}} style={{height:78,width:78,borderRadius:14,backgroundColor:'#e8ece5'}}/><Pressable accessibilityLabel="Remove photo" onPress={()=>onChange(images.filter((_,i)=>i!==index))} style={{position:'absolute',right:3,top:3,width:23,height:23,borderRadius:12,backgroundColor:'#18352e',alignItems:'center',justifyContent:'center'}}><Text style={{color:'white',fontWeight:'900'}}>×</Text></Pressable></View>)}</ScrollView><View style={{flexDirection:'row',gap:9}}><Pressable onPress={()=>add('camera')} style={{flex:1,padding:12,borderRadius:14,backgroundColor:'#eaf1df',alignItems:'center'}}><Text style={{fontWeight:'800',color:colors.green}}>📷  Take photo</Text></Pressable><Pressable onPress={()=>add('gallery')} style={{flex:1,padding:12,borderRadius:14,backgroundColor:'white',borderWidth:1,borderColor:colors.line,alignItems:'center'}}><Text style={{fontWeight:'800',color:colors.ink}}>▧  Choose photos</Text></Pressable></View></View>
}
