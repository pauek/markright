# ADT
```
Markright = List(Paragraph | Command(Markright)) // Vertical
Paragraph = List(String    | Command(Paragraph)) // Horizontal

Command(T) = {
  name: String
  args: List(String)
  content: T
}
```

# La separación por líneas es inútil

Introduce una partición que no debe existir. Un párrafo, si tuvieras un ancho infinito, es
simplemente una línea. Las distintas líneas de un párrafo se cortan por cierto sitio de forma
arbitraria, según el ancho que el usuario ha decidido. Un párrafo es una secuencia de texto, que
incidentalmente está cortada en líneas porque es demasiado larga:
```
@bla
  a b c d e
  f g h i j k

Es lo mismo que:

@bla
  a b c d e f g h i j k
```

Se puede hacer la simplificación que hasta que no pillas una línea vacía te quedas en el mismo
párrafo:
```
@cmd1
  a b c d e 
  f g h i j

  x y z t w

Es lo mismo que

@cmd1
  a b c d e f g h i j k

  x y z t w
``` 

Para el caso de comandos inline, entonces da un poco igual si cortas la línea o no, porque
se van a juntar de todas formas (con espacios, por cierto):
```
@cmd1
  Officia amet labore incididunt consectetur. Consectetur consectetur tempor
  irure anim nostrud. @em{Nulla deserunt ullamco ad reprehenderit exercitation anim
  officia anim irure eu exercitation ut proident commodo. Anim dolor do Lorem
  do id nulla culpa veniam consectetur.} Qui proident labore culpa duis officia
  aute nisi elit reprehenderit esse pariatur ipsum tempor.
```
Esto es lo mismo que (en VSCode hay que hacer Alt+Z para el folding).
```
@cmd1
  Officia amet labore incididunt consectetur. Consectetur consectetur tempor irure anim nostrud. @em{Nulla deserunt ullamco ad reprehenderit exercitation anim officia anim irure eu exercitation ut proident commodo. Anim dolor do Lorem do id nulla culpa veniam consectetur.} Qui proident labore culpa duis officia aute nisi elit reprehenderit esse pariatur ipsum tempor.
```

## Commands: Block vs Inline

Ejemplo de inline command erróneo porque introduce una línea vacía en el párrafo donde está:
```
  Parrafo 1

  @blockCmd
    bla bli blo
    12345

  Este es el segundo parrafo con un comando inline
  @inlineCmd{Pero en este texto, que irá inline con el resto,
  no tiene sentido meter comandos separados por párrafos!
                                <-- Here
  @comoEste(ups!)} y luego seguir con el párrafo que teníamos.
```

Así que el ADT debería distinguir entre comandos block e inline porque dentro de
un comando block puedes meter párrafos (un objeto Markright) pero en un comando
inline solo puedes meter un párrafo, y ahora tenía esto mezclado.

Cómo sabemos que un comando es inline??
1) Porque no tiene una línea vacía detrás.

# ParagraphCommand: No.

Esto:
```
@some_shit
  bla bla bla
  @cmd
    1 2 3
  bli bli bli
```
es lo mismo que esto:
```
@some_shit
  bla bla bla @cmd{1 2 3} bli bli bli
```

# Editor Visual

Pensando el editor de tipo AST (como Dion), entonces el formato este da bastante igual.
Puedes guardar la estructura de datos como s-exps y te lo haces fácil para tí mismo.
Se puede pensar en una estructura general tipo sexps pero binaria?

Hay que empezar a pensar en que los ficheros de texto no son la mejor manera, y salir del "frame of
mind" de que siempre necesitas la representación textual porque así la puedes editar.

Por otro lado, el coste de guardar las cosas en modo texto no es enorme y permite añadir los
editores de tipo texto...

# Comandos "raw" (acabados en "*")

Cómo gestionar los comandos "raw", que no alteran el texto que tiene debajo?
Éstos deben respetar el texto tal cual está (es decir, las líneas se deben preservar, o sea los '\n').
El parser no debe entrar en éstos porque quizás contienen texto que tiene formato especial.

En realidad el editor visual es immune a esto, debe preservar el formato y punto (y quizás mostrar
una fuente monospace!). El formato usado para la representación textual sí es importante pero se
puede hacer con comandos tipo bloque (puedes tener un comando raw inline?), si el texto interno del
comando raw tiene más de una línea.

```
@code*
   void main(args: [String]) {
     print("${args[0]} -> @a@b@c");
   }

Look at this code: @code*{console.log("@a@b@c");}.
```

Un tipo de error es tener un comando raw inline que se corta:
```
Look at this code @code*[[[void main(args: [String]) {
  print(args[0]);
}]]] and the next text...
```

El error es: un comando inline raw no puede tener '\n' dentro!