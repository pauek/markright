# AST
```
Markright = List<Paragraph | Command>
Paragraph = List<Line>
Command = {
  name: String
  args: List<String>
  content: List<Line>
}
Line = List<String | Command>
```

# Solo hay un tipo de Command

Si quieres un texto así:

  Officia amet labore incididunt consectetur. Consectetur consectetur tempor
  irure anim nostrud. @em{Nulla deserunt ullamco ad reprehenderit exercitation anim
  officia anim irure eu exercitation ut proident commodo. Anim dolor do Lorem
  do id nulla culpa veniam consectetur.} Qui proident labore culpa duis officia
  aute nisi elit reprehenderit esse pariatur ipsum tempor.

donde quieres emfatizar una frase muy larga (y por tanto los delimitadores no
estan en la misma línea, rompiendo el parseo de comandos inline), entonces
deberías hacer:

  Officia amet labore incididunt consectetur. Consectetur consectetur tempor
  irure anim nostrud. 
  @em 
    Nulla deserunt ullamco ad reprehenderit exercitation anim officia anim
    irure eu exercitation ut proident commodo. Anim dolor do Lorem do id nulla
    culpa veniam consectetur.
  Qui proident labore culpa duis officia aute nisi elit reprehenderit esse
  pariatur ipsum tempor.

Es decir, una línea vacía parte los bloques -> regla simple! Esto hace que un
comando encontrado en un línea, lo que hará es hacer un "flatten" de las líneas
que tiene dentro.

## Commands: Block vs Inline

He quitado los Inline Commands pero salen diferencias con los Block commands.
Simplemente currar más la idea...

Por ejemplo:
```
  Parrafo 1

  @blockCmd
    bla bli blo
    12345

  Este es el segundo parrafo con un comando inline
  @inlineCmd
    Pero en este texto, que irá inline con el resto,
    no tiene sentido meter comandos separados por párrafos!
                                <-- Here
    @comoEste(ups!)
  y luego seguir con el párrafo que teníamos.
```

Así que el ADT debería distinguir entre comandos block e inline porque dentro de
un comando block puedes meter párrafos (un objeto Markright) pero en un comando
inline solo puedes meter List<Line>, y ahora tenía esto mezclado.

Cómo sabemos que un comando es inline??
1) Porque empieza a mitad de línea (easy).

      bla bla bla @inline1(a,b,c){hola} ...

2) Porque empieza a principio de línea y tiene texto más adelante
   
      @inline2{hola} bli bli bli ...

3) Porque empieza a principio de línea como un comando de bloque
   pero está pegado al texto:

      bla bla bla bla bla
      @inline3
         bli bli bli
      ... (esta línea puede estar, o no)
  

# ParagraphCommand ?

Ahora peleándome con el "log" para mostrar por pantalla el texto otra vez,
surgen comandos como:

  bla bla bla
  @cmd
    1 2 3
  bli bli bli

que son comandos que van a salir como elementos de párrafos.

O sea:

1) Comandos block:

    Paragraph 1.

    @block
      content

    Paragraph 2.

2) Comandos inparagraph (que mantienen el párrafo)

    Paragraph start...
    @inparagraph
      content
    ...paragraph end

3) Comandos inline:

    Start line... @inline{content} ...end line.

El ADT ha sido modificado de acorde con esto.


2020-04-05 Ahora ya funciona el parsing bien (falta control de errores, etc.)


# Processors

